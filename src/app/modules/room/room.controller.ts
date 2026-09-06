import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { AppError } from "../../utils/AppError.js";
import { RoomService } from "./room.service.js";
import type { RoomQueryInput } from "./room.validation.js";

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

const uploadImages = catchAsync(async (req: Request, res: Response) => {
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

  const files = req.files as Express.Multer.File[];
  const ipAddress = req.ip || req.socket.remoteAddress;

  const updatedRoom = await RoomService.uploadRoomImages(
    id,
    req.user.userId,
    req.user.role,
    files,
    ipAddress,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Room images uploaded and saved to database successfully",
    data: updatedRoom,
  });
});

const getAllRooms = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as unknown as RoomQueryInput;
  const result = await RoomService.getAllRooms(query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Rooms retrieved successfully",
    data: result,
  });
});

export const RoomController = {
  createRoom,
  getRoomById,
  updateRoom,
  uploadImages,
  getAllRooms,
};
