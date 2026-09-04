import httpStatus from "http-status";
import { AppError } from "../../utils/AppError.js";
import type { CreateUnitInput } from "./unit.validation.js";
import { prisma, UserRole } from "../../lib/prisma.js";

const createUnit = async (
	userId: string,
	userRole: UserRole,
	payload: CreateUnitInput,
	ipAddress?: string,
) => {
	const property = await prisma.property.findUnique({
		where: { id: payload.propertyId },
	});

	if (!property || property.deletedAt !== null) {
		throw new AppError(httpStatus.NOT_FOUND, "Target property not found");
	}

	// Ownership guard: only the property owner or an admin can add units
	if (userRole !== UserRole.ADMIN && property.ownerId !== userId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Forbidden: You are not authorized to add units to this property",
		);
	}

	const existingUnit = await prisma.unit.findUnique({
		where: {
			propertyId_unitNumber: {
				propertyId: payload.propertyId,
				unitNumber: payload.unitNumber,
			},
		},
	});

	if (existingUnit && existingUnit.deletedAt === null) {
		throw new AppError(
			httpStatus.CONFLICT,
			`Unit number '${payload.unitNumber}' already exists in this property`,
		);
	}

	const unit = await prisma.$transaction(async (tx) => {
		const newUnit = await tx.unit.create({
			data: {
				propertyId: payload.propertyId,
				unitNumber: payload.unitNumber,
				floor: payload.floor,
			},
		});

		await tx.auditLog.create({
			data: {
				userId,
				action: "UNIT_CREATED",
				resource: "units",
				resourceId: newUnit.id,
				newValue: {
					propertyId: newUnit.propertyId,
					unitNumber: newUnit.unitNumber,
					floor: newUnit.floor,
				},
				ipAddress: ipAddress ?? null,
			},
		});

		return newUnit;
	});

	return unit;
};

export const UnitService = {
	createUnit,
};
