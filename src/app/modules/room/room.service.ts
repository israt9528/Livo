import httpStatus from "http-status";
import { AppError } from "../../utils/AppError.js";
import type { CreateRoomInput, UpdateRoomInput } from "./room.validation.js";
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

	// Ownership check
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

	// Ownership check
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

export const RoomService = {
	createRoom,
	getRoomById,
	updateRoom,
};
