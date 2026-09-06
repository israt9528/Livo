import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { AppError } from "../../utils/AppError.js";
import { UnitService } from "./unit.service.js";
import type { UnitQueryInput } from "./unit.validation.js";

const createUnit = catchAsync(async (req: Request, res: Response) => {
  if (!req.user?.userId || !req.user?.role) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Authentication credentials required",
    );
  }

  const ipAddress = req.ip || req.socket.remoteAddress;
  const unit = await UnitService.createUnit(
    req.user.userId,
    req.user.role,
    req.body,
    ipAddress,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Unit created successfully in property",
    data: unit,
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
    throw new AppError(httpStatus.BAD_REQUEST, "A valid Unit ID is required");
  }

  const files = req.files as Express.Multer.File[];
  const ipAddress = req.ip || req.socket.remoteAddress;

  const updatedUnit = await UnitService.uploadUnitImages(
    id,
    req.user.userId,
    req.user.role,
    files,
    ipAddress,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Unit images uploaded and saved to database successfully",
    data: updatedUnit,
  });
});

const getAllUnits = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as unknown as UnitQueryInput;
  const result = await UnitService.getAllUnits(query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Units retrieved successfully",
    data: result,
  });
});

export const UnitController = {
  createUnit,
  uploadImages,
  getAllUnits,
};
