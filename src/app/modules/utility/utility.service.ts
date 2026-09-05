import httpStatus from "http-status";
import {
	BillStatus,
	LeaseStatus,
	prisma,
	SplitStatus,
	UserRole,
} from "../../lib/prisma";
import { AppError } from "../../utils/AppError.js";
import { PaginationUtils } from "../../utils/pagination.js";
import type {
	CreateUtilityBillInput,
	UtilityQueryInput,
} from "./utility.validation.js";

/**
 * Precision-cent split distribution algorithm
 * Guarantees that sum(splits) === totalAmount exactly to the cent.
 */
const calculatePrecisionSplits = (
	totalAmount: number,
	tenantIds: string[],
): { tenantId: string; amount: number }[] => {
	const tenantCount = tenantIds.length;
	if (tenantCount === 0) return [];

	const totalCents = Math.round(totalAmount * 100);
	const baseCentsPerTenant = Math.floor(totalCents / tenantCount);
	const remainderCents = totalCents % tenantCount;

	return tenantIds.map((tenantId, index) => {
		const centsForTenant =
			baseCentsPerTenant + (index < remainderCents ? 1 : 0);
		return {
			tenantId,
			amount: centsForTenant / 100,
		};
	});
};

const createUtilityBill = async (
	userId: string,
	userRole: UserRole,
	payload: CreateUtilityBillInput,
	ipAddress?: string,
) => {
	const unit = await prisma.unit.findUnique({
		where: { id: payload.unitId },
		include: {
			property: true,
			rooms: {
				include: {
					leases: {
						where: { status: LeaseStatus.ACTIVE },
						select: { tenantId: true },
					},
				},
			},
		},
	});

	if (!unit || unit.deletedAt !== null || unit.property.deletedAt !== null) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Target unit or property not found",
		);
	}

	// Ownership verification
	if (userRole !== UserRole.ADMIN && unit.property.ownerId !== userId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Forbidden: You are not authorized to bill utilities for this property",
		);
	}

	// Check unique constraint: unitId + billType + billingMonth
	const existingBill = await prisma.utilityBill.findUnique({
		where: {
			unitId_billType_billingMonth: {
				unitId: payload.unitId,
				billType: payload.billType,
				billingMonth: payload.billingMonth,
			},
		},
	});

	if (existingBill) {
		throw new AppError(
			httpStatus.CONFLICT,
			`A ${payload.billType} bill has already been created for unit ${unit.unitNumber} for month ${payload.billingMonth}`,
		);
	}

	// Discover all distinct active tenants currently residing in this unit
	const activeTenantIds = Array.from(
		new Set(
			unit.rooms.flatMap((room) => room.leases.map((lease) => lease.tenantId)),
		),
	);

	if (activeTenantIds.length === 0) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot split utility bill: There are no active tenant leases currently occupying this unit.",
		);
	}

	const splits = calculatePrecisionSplits(payload.totalAmount, activeTenantIds);

	const result = await prisma.$transaction(async (tx) => {
		const bill = await tx.utilityBill.create({
			data: {
				unitId: payload.unitId,
				billType: payload.billType,
				totalAmount: payload.totalAmount,
				dueDate: new Date(payload.dueDate),
				billingMonth: payload.billingMonth,
				invoiceUrl: payload.invoiceUrl ?? null,
				status: BillStatus.PENDING,
				splits: {
					create: splits.map((s) => ({
						tenantId: s.tenantId,
						amount: s.amount,
						status: SplitStatus.UNPAID,
					})),
				},
			},
			include: {
				splits: {
					include: {
						tenant: {
							select: { id: true, name: true, email: true },
						},
					},
				},
			},
		});

		await tx.auditLog.create({
			data: {
				userId,
				action: "UTILITY_BILL_ISSUED",
				resource: "utility_bills",
				resourceId: bill.id,
				newValue: {
					billType: bill.billType,
					totalAmount: payload.totalAmount,
					tenantCount: activeTenantIds.length,
					billingMonth: bill.billingMonth,
				},
				ipAddress: ipAddress ?? null,
			},
		});

		return bill;
	});

	return result;
};

const getMySplits = async (tenantId: string, query: UtilityQueryInput) => {
	const { page, limit, skip, take } = PaginationUtils.calculatePagination(
		query,
		"createdAt",
	);

	const whereClause = {
		tenantId,
		...(query.splitStatus && { status: query.splitStatus }),
	};

	const [total, splits] = await Promise.all([
		prisma.billSplit.count({ where: whereClause }),
		prisma.billSplit.findMany({
			where: whereClause,
			skip,
			take,
			orderBy: { createdAt: "desc" },
			include: {
				utilityBill: {
					select: {
						id: true,
						billType: true,
						totalAmount: true,
						dueDate: true,
						billingMonth: true,
						invoiceUrl: true,
						status: true,
						unit: {
							select: {
								unitNumber: true,
								property: {
									select: { title: true, address: true },
								},
							},
						},
					},
				},
			},
		}),
	]);

	const meta = PaginationUtils.formatPaginationMeta(total, page, limit);

	return {
		meta,
		splits,
	};
};

const getUnitBills = async (
	unitId: string,
	userId: string,
	userRole: UserRole,
	query: UtilityQueryInput,
) => {
	const unit = await prisma.unit.findUnique({
		where: { id: unitId },
		include: { property: true },
	});

	if (!unit || unit.deletedAt !== null) {
		throw new AppError(httpStatus.NOT_FOUND, "Unit not found");
	}

	if (userRole !== UserRole.ADMIN && unit.property.ownerId !== userId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Forbidden: You are not authorized to view bills for this unit",
		);
	}

	const { page, limit, skip, take } = PaginationUtils.calculatePagination(
		query,
		"createdAt",
	);

	const whereClause = {
		unitId,
		...(query.status && { status: query.status }),
	};

	const [total, bills] = await Promise.all([
		prisma.utilityBill.count({ where: whereClause }),
		prisma.utilityBill.findMany({
			where: whereClause,
			skip,
			take,
			orderBy: { createdAt: "desc" },
			include: {
				splits: {
					include: {
						tenant: {
							select: { id: true, name: true, email: true },
						},
					},
				},
			},
		}),
	]);

	const meta = PaginationUtils.formatPaginationMeta(total, page, limit);

	return {
		meta,
		bills,
	};
};

const settleSplit = async (
	splitId: string,
	userId: string,
	userRole: UserRole,
	ipAddress?: string,
) => {
	const split = await prisma.billSplit.findUnique({
		where: { id: splitId },
		include: {
			utilityBill: {
				include: {
					unit: {
						include: { property: true },
					},
				},
			},
		},
	});

	if (!split) {
		throw new AppError(httpStatus.NOT_FOUND, "Utility split invoice not found");
	}

	const isTenant = split.tenantId === userId;
	const isOwner = split.utilityBill.unit.property.ownerId === userId;
	const isAdmin = userRole === UserRole.ADMIN;

	if (!isTenant && !isOwner && !isAdmin) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Forbidden: You are not authorized to settle this utility invoice",
		);
	}

	if (split.status === SplitStatus.PAID) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"This utility split has already been marked as paid",
		);
	}

	const updatedResult = await prisma.$transaction(async (tx) => {
		// 1. Mark individual split as PAID
		const updatedSplit = await tx.billSplit.update({
			where: { id: splitId },
			data: {
				status: SplitStatus.PAID,
				paidAt: new Date(),
			},
			include: {
				utilityBill: true,
			},
		});

		// 2. Fetch sibling splits to determine parent bill status
		const allSplits = await tx.billSplit.findMany({
			where: { utilityBillId: split.utilityBillId },
			select: { status: true },
		});

		const allPaid = allSplits.every((s) => s.status === SplitStatus.PAID);
		const newBillStatus = allPaid
			? BillStatus.SETTLED
			: BillStatus.PARTIALLY_PAID;

		// 3. Update master invoice status
		await tx.utilityBill.update({
			where: { id: split.utilityBillId },
			data: { status: newBillStatus },
		});

		// 4. Record audit log
		await tx.auditLog.create({
			data: {
				userId,
				action: "UTILITY_SPLIT_SETTLED",
				resource: "bill_splits",
				resourceId: splitId,
				oldValue: { status: SplitStatus.UNPAID },
				newValue: {
					status: SplitStatus.PAID,
					parentBillStatus: newBillStatus,
				},
				ipAddress: ipAddress ?? null,
			},
		});

		return updatedSplit;
	});

	return updatedResult;
};

export const UtilityService = {
	createUtilityBill,
	getMySplits,
	getUnitBills,
	settleSplit,
};
