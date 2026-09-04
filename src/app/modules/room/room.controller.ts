import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { AppError } from "../../utils/AppError.js";
import { RoomService } from "./room.service.js";

const createRoom = catchAsync(async (req: Request, res: Response) => {
	if (!req.user?.userId || !req.user?.role) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Authentication credentials required",
		);
	}

	const ipAddress = req.ip || req.socket.remoteAddress;
	const room = await RoomService.createRoom(
		req.user.userId,
		req.user.role,
		req.body,
		ipAddress,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Room created successfully",
		data: room,
	});
});

const getRoomById = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params;
	if (!id || typeof id !== "string") {
		throw new AppError(httpStatus.BAD_REQUEST, "A valid Room ID is required");
	}

	const room = await RoomService.getRoomById(id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Room details retrieved successfully",
		data: room,
	});
});

const updateRoom = catchAsync(async (req: Request, res: Response) => {
	if (!req.user?.userId || !req.user?.role) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Authentication credentials required",
		);
	}

	const { id } = req.params;
	if (!id || typeof id !== "string") {
		throw new AppError(httpStatus.BAD_REQUEST, "A valid Room ID is required");
	}

	const ipAddress = req.ip || req.socket.remoteAddress;
	const updatedRoom = await RoomService.updateRoom(
		id,
		req.user.userId,
		req.user.role,
		req.body,
		ipAddress,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Room updated successfully",
		data: updatedRoom,
	});
});

export const RoomController = {
	createRoom,
	getRoomById,
	updateRoom,
};
