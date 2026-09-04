import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { AppError } from "../../utils/AppError.js";
import { UserService } from "./user.service.js";

const getMe = catchAsync(async (req: Request, res: Response) => {
  if (!req.user?.userId) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Authentication credentials required",
    );
  }

  const userProfile = await UserService.getMe(req.user.userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User profile retrieved successfully",
    data: userProfile,
  });
});

const updateMe = catchAsync(async (req: Request, res: Response) => {
  if (!req.user?.userId) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Authentication credentials required",
    );
  }

  const ipAddress = req.ip || req.socket.remoteAddress;
  const updatedProfile = await UserService.updateMe(
    req.user.userId,
    req.body,
    ipAddress,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User profile updated successfully",
    data: updatedProfile,
  });
});

export const UserController = {
  getMe,
  updateMe,
};
