import httpStatus from "http-status";
import {
	ApplicationStatus,
	LeaseStatus,
	prisma,
	RoomStatus,
	UserRole,
} from "../../lib/prisma";
import { AppError } from "../../utils/AppError.js";
import type { CreateLeaseInput, TerminateLeaseInput } from "./lease.validation";

const createLease = async (
	userId: string,
	userRole: UserRole,
	payload: CreateLeaseInput,
	ipAddress?: string,
) => {
	const room = await prisma.room.findUnique({
		where: { id: payload.roomId },
		include: {
			unit: {
				include: { property: true },
			},
		},
	});

	if (!room || room.deletedAt !== null || room.unit.deletedAt !== null) {
		throw new AppError(httpStatus.NOT_FOUND, "Target room or unit not found");
	}

	// Ownership verification
	if (userRole !== UserRole.ADMIN && room.unit.property.ownerId !== userId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Forbidden: You are not authorized to create a lease for this property",
		);
	}

	// Cannot lease a room that is already occupied
	if (room.status === RoomStatus.OCCUPIED) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Cannot create lease: This room is already occupied by an active tenant",
		);
	}

	// Verify target tenant exists and is active
	const tenant = await prisma.user.findUnique({
		where: { id: payload.tenantId },
	});

	if (!tenant || tenant.deletedAt !== null) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Tenant not found or account is inactive",
		);
	}

	// Atomic transaction: Create Lease, set Room to OCCUPIED, complete pending applications, log audit
	const lease = await prisma.$transaction(async (tx) => {
		const newLease = await tx.lease.create({
			data: {
				tenantId: payload.tenantId,
				roomId: payload.roomId,
				startDate: new Date(payload.startDate),
				endDate: new Date(payload.endDate),
				rentAmount: payload.rentAmount,
				depositAmount: payload.depositAmount,
				terms: payload.terms ?? "Standard residential tenancy terms apply.",
				status: LeaseStatus.ACTIVE,
			},
			include: {
				room: {
					select: {
						id: true,
						roomNumber: true,
						rentAmount: true,
						unit: {
							select: {
								unitNumber: true,
								property: {
									select: { id: true, title: true, address: true },
								},
							},
						},
					},
				},
				tenant: {
					select: { id: true, name: true, email: true, phoneNumber: true },
				},
			},
		});

		// 1. Flip room status to OCCUPIED and clear any reservation expiration
		await tx.room.update({
			where: { id: payload.roomId },
			data: {
				status: RoomStatus.OCCUPIED,
				reservationExpiresAt: null,
			},
		});

		// 2. Mark any approved application for this tenant and room as COMPLETED
		await tx.application.updateMany({
			where: {
				tenantId: payload.tenantId,
				roomId: payload.roomId,
				status: ApplicationStatus.APPROVED,
			},
			data: {
				status: ApplicationStatus.COMPLETED,
			},
		});

		// 3. Record audit trail
		await tx.auditLog.create({
			data: {
				userId,
				action: "LEASE_ACTIVATED",
				resource: "leases",
				resourceId: newLease.id,
				newValue: {
					tenantId: newLease.tenantId,
					roomId: newLease.roomId,
					startDate: newLease.startDate,
					endDate: newLease.endDate,
					rentAmount: newLease.rentAmount,
				},
				ipAddress: ipAddress ?? null,
			},
		});

		return newLease;
	});

	return lease;
};

const getMyLease = async (tenantId: string) => {
	const lease = await prisma.lease.findFirst({
		where: {
			tenantId,
			status: LeaseStatus.ACTIVE,
		},
		include: {
			room: {
				include: {
					unit: {
						include: {
							property: {
								include: {
									owner: {
										select: {
											id: true,
											name: true,
											email: true,
											phoneNumber: true,
										},
									},
								},
							},
							// Fetch co-occupants in other rooms of this flat/unit
							rooms: {
								where: {
									id: { not: undefined },
								},
								include: {
									leases: {
										where: { status: LeaseStatus.ACTIVE },
										include: {
											tenant: {
												select: {
													id: true,
													name: true,
													email: true,
													phoneNumber: true,
													avatarUrl: true,
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	});

	if (!lease || lease.deletedAt !== null) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"No active lease agreement found for your account",
		);
	}

	// Extract other active co-occupants sharing this apartment unit
	const coOccupants = lease.room.unit.rooms
		.filter((r) => r.id !== lease.roomId)
		.flatMap((r) =>
			r.leases.map((activeLease) => ({
				roomNumber: r.roomNumber,
				tenant: activeLease.tenant,
				leaseStart: activeLease.startDate,
			})),
		);

	return {
		lease: {
			id: lease.id,
			startDate: lease.startDate,
			endDate: lease.endDate,
			rentAmount: lease.rentAmount,
			depositAmount: lease.depositAmount,
			terms: lease.terms,
			status: lease.status,
		},
		room: {
			id: lease.room.id,
			roomNumber: lease.room.roomNumber,
			dimensions: lease.room.dimensions,
			features: lease.room.features,
		},
		unit: {
			id: lease.room.unit.id,
			unitNumber: lease.room.unit.unitNumber,
			floor: lease.room.unit.floor,
		},
		property: {
			id: lease.room.unit.property.id,
			title: lease.room.unit.property.title,
			address: lease.room.unit.property.address,
			city: lease.room.unit.property.city,
			owner: lease.room.unit.property.owner,
		},
		coOccupants,
	};
};

const getLeaseById = async (
	leaseId: string,
	userId: string,
	userRole: UserRole,
) => {
	const lease = await prisma.lease.findUnique({
		where: { id: leaseId },
		include: {
			tenant: {
				select: { id: true, name: true, email: true, phoneNumber: true },
			},
			room: {
				include: {
					unit: {
						include: {
							property: {
								select: { id: true, title: true, address: true, ownerId: true },
							},
						},
					},
				},
			},
		},
	});

	if (!lease || lease.deletedAt !== null) {
		throw new AppError(httpStatus.NOT_FOUND, "Lease record not found");
	}

	const isTenant = lease.tenantId === userId;
	const isOwner = lease.room.unit.property.ownerId === userId;
	const isAdmin = userRole === UserRole.ADMIN;

	if (!isTenant && !isOwner && !isAdmin) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Forbidden: You are not authorized to view this lease agreement",
		);
	}

	return lease;
};

const terminateLease = async (
	leaseId: string,
	userId: string,
	userRole: UserRole,
	payload: TerminateLeaseInput,
	ipAddress?: string,
) => {
	const existingLease = await prisma.lease.findUnique({
		where: { id: leaseId },
		include: {
			room: {
				include: {
					unit: {
						include: { property: true },
					},
				},
			},
		},
	});

	if (!existingLease || existingLease.deletedAt !== null) {
		throw new AppError(httpStatus.NOT_FOUND, "Lease record not found");
	}

	const isOwner = existingLease.room.unit.property.ownerId === userId;
	const isAdmin = userRole === UserRole.ADMIN;

	if (!isOwner && !isAdmin) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Forbidden: Only the property owner or administrator can terminate a lease agreement",
		);
	}

	if (existingLease.status !== LeaseStatus.ACTIVE) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Cannot terminate: Lease is already ${existingLease.status.toLowerCase()}`,
		);
	}

	// Atomic transaction: Terminate lease, restore room to AVAILABLE, record audit log
	const terminatedLease = await prisma.$transaction(async (tx) => {
		const updated = await tx.lease.update({
			where: { id: leaseId },
			data: {
				status: LeaseStatus.TERMINATED,
			},
			include: {
				room: {
					select: { id: true, roomNumber: true },
				},
				tenant: {
					select: { id: true, name: true, email: true },
				},
			},
		});

		// Restore room status to AVAILABLE
		await tx.room.update({
			where: { id: existingLease.roomId },
			data: {
				status: RoomStatus.AVAILABLE,
				reservationExpiresAt: null,
			},
		});

		// Record audit trail
		await tx.auditLog.create({
			data: {
				userId,
				action: "LEASE_TERMINATED",
				resource: "leases",
				resourceId: leaseId,
				oldValue: { status: existingLease.status },
				newValue: { status: LeaseStatus.TERMINATED, reason: payload.reason },
				ipAddress: ipAddress ?? null,
			},
		});

		return updated;
	});

	return terminatedLease;
};

export const LeaseService = {
	createLease,
	getMyLease,
	getLeaseById,
	terminateLease,
};
