import httpStatus from "http-status";
import { AppError } from "../../utils/AppError.js";
import { PaginationUtils } from "../../utils/pagination.js";
import { uploadMultipleBuffersToCloudinary } from "../../utils/cloudinaryUpload.js";
import type { CreateUnitInput, UnitQueryInput } from "./unit.validation.js";
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
        images: payload.images ?? [],
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

const uploadUnitImages = async (
  unitId: string,
  userId: string,
  userRole: UserRole,
  files: Express.Multer.File[],
  ipAddress?: string,
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
      "Forbidden: You are not authorized to upload images for this unit",
    );
  }

  if (!files || files.length === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Please provide at least one image file",
    );
  }

  const uploadedUrls = await uploadMultipleBuffersToCloudinary(files, "units");

  const updatedUnit = await prisma.$transaction(async (tx) => {
    const updated = await tx.unit.update({
      where: { id: unitId },
      data: {
        images: {
          push: uploadedUrls,
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: "UNIT_IMAGES_UPLOADED",
        resource: "units",
        resourceId: unitId,
        newValue: {
          addedImages: uploadedUrls,
          totalCount: updated.images.length,
        },
        ipAddress: ipAddress ?? null,
      },
    });

    return updated;
  });

  return updatedUnit;
};

const getAllUnits = async (query: UnitQueryInput) => {
  const { page, limit, skip, take, sortBy, sortOrder } =
    PaginationUtils.calculatePagination(query, "createdAt");

  const whereClause = {
    deletedAt: null,
    ...(query.propertyId && { propertyId: query.propertyId }),
    ...(query.floor !== undefined && { floor: query.floor }),
  };

  const [total, units] = await Promise.all([
    prisma.unit.count({ where: whereClause }),
    prisma.unit.findMany({
      where: whereClause,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            city: true,
            address: true,
          },
        },
        rooms: {
          where: { deletedAt: null },
          select: {
            id: true,
            roomNumber: true,
            rentAmount: true,
            status: true,
            images: true,
          },
        },
      },
    }),
  ]);

  const meta = PaginationUtils.formatPaginationMeta(total, page, limit);

  return { meta, units };
};

export const UnitService = {
  createUnit,
  uploadUnitImages,
  getAllUnits,
};
