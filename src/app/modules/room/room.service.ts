import httpStatus from "http-status";
import { AppError } from "../../utils/AppError.js";
import { PaginationUtils } from "../../utils/pagination.js";
import { uploadMultipleBuffersToCloudinary } from "../../utils/cloudinaryUpload.js";
import type {
  CreateRoomInput,
  UpdateRoomInput,
  RoomQueryInput,
} from "./room.validation.js";
import { prisma, RoomStatus, UserRole } from "../../lib/prisma.js";

const createRoom = async (
  userId: string,
  userRole: UserRole,
  payload: CreateRoomInput,
  ipAddress?: string,
) => {
  const unit = await prisma.unit.findUnique({
    where: { id: payload.unitId },
    include: { property: true },
  });

  if (!unit || unit.deletedAt !== null || unit.property.deletedAt !== null) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Target unit or property not found",
    );
  }

  if (userRole !== UserRole.ADMIN && unit.property.ownerId !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Forbidden: You are not authorized to add rooms to this unit",
    );
  }

  const existingRoom = await prisma.room.findUnique({
    where: {
      unitId_roomNumber: {
        unitId: payload.unitId,
        roomNumber: payload.roomNumber,
      },
    },
  });

  if (existingRoom && existingRoom.deletedAt === null) {
    throw new AppError(
      httpStatus.CONFLICT,
      `Room number '${payload.roomNumber}' already exists in this unit`,
    );
  }

  const room = await prisma.$transaction(async (tx) => {
    const newRoom = await tx.room.create({
      data: {
        unitId: payload.unitId,
        roomNumber: payload.roomNumber,
        rentAmount: payload.rentAmount,
        depositAmount: payload.depositAmount,
        maxOccupancy: payload.maxOccupancy,
        features: payload.features,
        dimensions: payload.dimensions ?? null,
        images: payload.images ?? [],
        status: RoomStatus.AVAILABLE,
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: "ROOM_CREATED",
        resource: "rooms",
        resourceId: newRoom.id,
        newValue: {
          unitId: newRoom.unitId,
          roomNumber: newRoom.roomNumber,
          rentAmount: payload.rentAmount,
        },
        ipAddress: ipAddress ?? null,
      },
    });

    return newRoom;
  });

  return room;
};

const getRoomById = async (roomId: string) => {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
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
                  avatarUrl: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!room || room.deletedAt !== null) {
    throw new AppError(httpStatus.NOT_FOUND, "Room not found");
  }

  return room;
};

const updateRoom = async (
  roomId: string,
  userId: string,
  userRole: UserRole,
  payload: UpdateRoomInput,
  ipAddress?: string,
) => {
  const existingRoom = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      unit: {
        include: { property: true },
      },
    },
  });

  if (!existingRoom || existingRoom.deletedAt !== null) {
    throw new AppError(httpStatus.NOT_FOUND, "Room not found");
  }

  if (
    userRole !== UserRole.ADMIN &&
    existingRoom.unit.property.ownerId !== userId
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Forbidden: You are not authorized to modify this room",
    );
  }

  const updatedRoom = await prisma.$transaction(async (tx) => {
    const room = await tx.room.update({
      where: { id: roomId },
      data: {
        ...(payload.rentAmount !== undefined && {
          rentAmount: payload.rentAmount,
        }),
        ...(payload.depositAmount !== undefined && {
          depositAmount: payload.depositAmount,
        }),
        ...(payload.maxOccupancy !== undefined && {
          maxOccupancy: payload.maxOccupancy,
        }),
        ...(payload.features !== undefined && { features: payload.features }),
        ...(payload.dimensions !== undefined && {
          dimensions: payload.dimensions,
        }),
        ...(payload.images !== undefined && { images: payload.images }),
        ...(payload.status !== undefined && { status: payload.status }),
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: "ROOM_UPDATED",
        resource: "rooms",
        resourceId: roomId,
        oldValue: {
          rentAmount: existingRoom.rentAmount,
          status: existingRoom.status,
        },
        newValue: payload,
        ipAddress: ipAddress ?? null,
      },
    });

    return room;
  });

  return updatedRoom;
};

const uploadRoomImages = async (
  roomId: string,
  userId: string,
  userRole: UserRole,
  files: Express.Multer.File[],
  ipAddress?: string,
) => {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { unit: { include: { property: true } } },
  });

  if (!room || room.deletedAt !== null) {
    throw new AppError(httpStatus.NOT_FOUND, "Room not found");
  }

  if (userRole !== UserRole.ADMIN && room.unit.property.ownerId !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Forbidden: You are not authorized to upload images for this room",
    );
  }

  if (!files || files.length === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Please provide at least one image file",
    );
  }

  const uploadedUrls = await uploadMultipleBuffersToCloudinary(files, "rooms");

  const updatedRoom = await prisma.$transaction(async (tx) => {
    const updated = await tx.room.update({
      where: { id: roomId },
      data: {
        images: {
          push: uploadedUrls,
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: "ROOM_IMAGES_UPLOADED",
        resource: "rooms",
        resourceId: roomId,
        newValue: {
          addedImages: uploadedUrls,
          totalCount: updated.images.length,
        },
        ipAddress: ipAddress ?? null,
      },
    });

    return updated;
  });

  return updatedRoom;
};

const getAllRooms = async (query: RoomQueryInput) => {
  const { page, limit, skip, take, sortBy, sortOrder } =
    PaginationUtils.calculatePagination(query, "createdAt");

  const whereClause = {
    deletedAt: null,
    ...(query.unitId && { unitId: query.unitId }),
    ...(query.status && { status: query.status }),
    ...((query.minRent !== undefined || query.maxRent !== undefined) && {
      rentAmount: {
        ...(query.minRent !== undefined && { gte: query.minRent }),
        ...(query.maxRent !== undefined && { lte: query.maxRent }),
      },
    }),
  };

  const [total, rooms] = await Promise.all([
    prisma.room.count({ where: whereClause }),
    prisma.room.findMany({
      where: whereClause,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            floor: true,
            property: {
              select: {
                id: true,
                title: true,
                city: true,
                address: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const meta = PaginationUtils.formatPaginationMeta(total, page, limit);

  return { meta, rooms };
};

export const RoomService = {
  createRoom,
  getRoomById,
  updateRoom,
  uploadRoomImages,
  getAllRooms,
};
