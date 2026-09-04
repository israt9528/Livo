import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { AppError } from "../../utils/AppError.js";
import { ApplicationService } from "./application.service.js";
import { ApplicationQueryInput } from "./application.validation.js";

const createApplication = catchAsync(async (req: Request, res: Response) => {
  if (!req.user?.userId) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Authentication credentials required",
    );
  }

  const ipAddress = req.ip || req.socket.remoteAddress;
  const application = await ApplicationService.createApplication(
    req.user.userId,
    req.body,
    ipAddress,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Rental application submitted successfully",
    data: application,
  });
});

const getApplications = catchAsync(async (req: Request, res: Response) => {
  if (!req.user?.userId || !req.user?.role) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Authentication credentials required",
    );
  }

  const query = req.query as unknown as ApplicationQueryInput;
  const result = await ApplicationService.getApplications(
    req.user.userId,
    req.user.role,
    query,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Rental applications retrieved successfully",
    data: result,
  });
});

const getApplicationById = catchAsync(async (req: Request, res: Response) => {
  if (!req.user?.userId || !req.user?.role) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Authentication credentials required",
    );
  }

  const { id } = req.params;
  if (!id || typeof id !== "string") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "A valid Application ID is required",
    );
  }

  const application = await ApplicationService.getApplicationById(
    id,
    req.user.userId,
    req.user.role,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Application details retrieved successfully",
    data: application,
  });
});

const updateApplicationStatus = catchAsync(
  async (req: Request, res: Response) => {
    if (!req.user?.userId || !req.user?.role) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        "Authentication credentials required",
      );
    }

    const { id } = req.params;
    if (!id || typeof id !== "string") {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "A valid Application ID is required",
      );
    }

    const ipAddress = req.ip || req.socket.remoteAddress;
    const updatedApp = await ApplicationService.updateApplicationStatus(
      id,
      req.user.userId,
      req.user.role,
      req.body,
      ipAddress,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: `Application status updated to ${req.body.status}`,
      data: updatedApp,
    });
  },
);

export const ApplicationController = {
  createApplication,
  getApplications,
  getApplicationById,
  updateApplicationStatus,
};
