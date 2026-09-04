import httpStatus from "http-status";
import { AppError } from "../../utils/AppError.js";
import { PaginationUtils } from "../../utils/pagination.js";
import { SearchUtils } from "../../utils/searchFilter.js";
import type {
	CreatePropertyInput,
	UpdatePropertyInput,
	PropertyQueryInput,
} from "./property.validation.js";
import { LeaseStatus, prisma, UserRole } from "../../lib/prisma.js";

const createProperty = async (
	ownerId: string,
	payload: CreatePropertyInput,
	ipAddress?: string,
) => {
	const property = await prisma.$transaction(async (tx) => {
		const newProperty = await tx.property.create({
			data: {
				ownerId,
				title: payload.title,
				description: payload.description,
				address: payload.address,
				city: payload.city,
				zipCode: payload.zipCode,
				propertyType: payload.propertyType,
				images: payload.images,
			},
		});

		await tx.auditLog.create({
			data: {
				userId: ownerId,
				action: "PROPERTY_CREATED",
				resource: "properties",
				resourceId: newProperty.id,
				newValue: {
					title: newProperty.title,
					city: newProperty.city,
					propertyType: newProperty.propertyType,
				},
				ipAddress: ipAddress ?? null,
			},
		});

		return newProperty;
	});

	return property;
};

const getProperties = async (query: PropertyQueryInput) => {
	const { page, limit, skip, take, sortBy, sortOrder } =
		PaginationUtils.calculatePagination(query, "createdAt");

	const whereClause = SearchUtils.buildWhereClause({
		searchTerm: query.q,
		searchableFields: ["title", "description", "address", "city"],
		filters: {
			...(query.city && { city: { equals: query.city, mode: "insensitive" } }),
			...(query.propertyType && { propertyType: query.propertyType }),
		},
	});

	const [total, properties] = await Promise.all([
		prisma.property.count({ where: whereClause }),
		prisma.property.findMany({
			where: whereClause,
			skip,
			take,
			orderBy: { [sortBy]: sortOrder },
			include: {
				owner: {
					select: {
						id: true,
						name: true,
						email: true,
						phoneNumber: true,
						avatarUrl: true,
					},
				},
				units: {
					include: {
						rooms: {
							select: {
								id: true,
								roomNumber: true,
								rentAmount: true,
								depositAmount: true,
								status: true,
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
		properties,
	};
};

const getPropertyById = async (id: string) => {
	const property = await prisma.property.findUnique({
		where: { id },
		include: {
			owner: {
				select: {
					id: true,
					name: true,
					email: true,
					phoneNumber: true,
					avatarUrl: true,
				},
			},
			units: {
				include: {
					rooms: {
						select: {
							id: true,
							roomNumber: true,
							rentAmount: true,
							depositAmount: true,
							maxOccupancy: true,
							features: true,
							dimensions: true,
							status: true,
						},
					},
				},
			},
		},
	});

	if (!property || property.deletedAt !== null) {
		throw new AppError(httpStatus.NOT_FOUND, "Property listing not found");
	}

	return property;
};

const updateProperty = async (
	propertyId: string,
	userId: string,
	userRole: UserRole,
	payload: UpdatePropertyInput,
	ipAddress?: string,
) => {
	const existingProperty = await prisma.property.findUnique({
		where: { id: propertyId },
	});

	if (!existingProperty || existingProperty.deletedAt !== null) {
		throw new AppError(httpStatus.NOT_FOUND, "Property listing not found");
	}

	// Strict ownership check: Only the owning OWNER or an ADMIN can modify
	if (userRole !== UserRole.ADMIN && existingProperty.ownerId !== userId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Forbidden: You are not authorized to update this property",
		);
	}

	const updatedProperty = await prisma.$transaction(async (tx) => {
		const property = await tx.property.update({
			where: { id: propertyId },
			data: {
				...(payload.title !== undefined && { title: payload.title }),
				...(payload.description !== undefined && {
					description: payload.description,
				}),
				...(payload.address !== undefined && { address: payload.address }),
				...(payload.city !== undefined && { city: payload.city }),
				...(payload.zipCode !== undefined && { zipCode: payload.zipCode }),
				...(payload.propertyType !== undefined && {
					propertyType: payload.propertyType,
				}),
				...(payload.images !== undefined && { images: payload.images }),
			},
		});

		await tx.auditLog.create({
			data: {
				userId,
				action: "PROPERTY_UPDATED",
				resource: "properties",
				resourceId: propertyId,
				oldValue: {
					title: existingProperty.title,
					city: existingProperty.city,
				},
				newValue: payload,
				ipAddress: ipAddress ?? null,
			},
		});

		return property;
	});

	return updatedProperty;
};

const deleteProperty = async (
	propertyId: string,
	userId: string,
	userRole: UserRole,
	ipAddress?: string,
) => {
	const existingProperty = await prisma.property.findUnique({
		where: { id: propertyId },
		include: {
			units: {
				include: {
					rooms: {
						include: {
							leases: {
								where: { status: LeaseStatus.ACTIVE },
							},
						},
					},
				},
			},
		},
	});

	if (!existingProperty || existingProperty.deletedAt !== null) {
		throw new AppError(httpStatus.NOT_FOUND, "Property listing not found");
	}

	// Strict ownership check
	if (userRole !== UserRole.ADMIN && existingProperty.ownerId !== userId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Forbidden: You are not authorized to delete this property",
		);
	}

	// Safety guard: Reject deletion if any room in this property has an active tenant lease
	const hasActiveLeases = existingProperty.units.some((unit) =>
		unit.rooms.some((room) => room.leases.length > 0),
	);

	if (hasActiveLeases) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot delete property with active tenant leases. Terminate or transfer all active leases first.",
		);
	}

	const now = new Date();

	// Cascade soft delete within atomic transaction
	await prisma.$transaction(async (tx) => {
		// 1. Soft delete property
		await tx.property.update({
			where: { id: propertyId },
			data: { deletedAt: now },
		});

		// 2. Soft delete all associated units
		const unitIds = existingProperty.units.map((u) => u.id);
		if (unitIds.length > 0) {
			await tx.unit.updateMany({
				where: { id: { in: unitIds } },
				data: { deletedAt: now },
			});

			// 3. Soft delete all rooms inside those units
			await tx.room.updateMany({
				where: { unitId: { in: unitIds } },
				data: { deletedAt: now },
			});
		}

		// 4. Record audit entry
		await tx.auditLog.create({
			data: {
				userId,
				action: "PROPERTY_SOFT_DELETED",
				resource: "properties",
				resourceId: propertyId,
				oldValue: { title: existingProperty.title },
				newValue: { deletedAt: now },
				ipAddress: ipAddress ?? null,
			},
		});
	});

	return true;
};

export const PropertyService = {
	createProperty,
	getProperties,
	getPropertyById,
	updateProperty,
	deleteProperty,
};
