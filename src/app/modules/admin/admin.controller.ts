import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { AppError } from "../../utils/AppError.js";
import { AdminService } from "./admin.service.js";
import { AdminUserQueryInput, AuditLogQueryInput } from "./admin.validation.js";

const getUsers = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as unknown as AdminUserQueryInput;
  const result = await AdminService.getUsers(query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Global users retrieved successfully",
    data: result,
  });
});

const updateUserStatus = catchAsync(async (req: Request, res: Response) => {
  if (!req.user?.userId) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Authentication credentials required",
    );
  }

  const { id } = req.params;
  if (!id || typeof id !== "string") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "A valid target User ID is required",
    );
  }

  const ipAddress = req.ip || req.socket.remoteAddress;
  const updatedUser = await AdminService.updateUserStatus(
    id,
    req.user.userId,
    req.body,
    ipAddress,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `User status updated to ${req.body.status}`,
    data: updatedUser,
  });
});

const updateUserRole = catchAsync(async (req: Request, res: Response) => {
  if (!req.user?.userId) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Authentication credentials required",
    );
  }

  const { id } = req.params;
  if (!id || typeof id !== "string") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "A valid target User ID is required",
    );
  }

  const ipAddress = req.ip || req.socket.remoteAddress;
  const updatedUser = await AdminService.updateUserRole(
    id,
    req.user.userId,
    req.body,
    ipAddress,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `User role successfully updated to ${req.body.role}`,
    data: updatedUser,
  });
});
const getPlatformOverviewAnalytics = catchAsync(
  async (_req: Request, res: Response) => {
    const analytics = await AdminService.getPlatformOverviewAnalytics();

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Platform overview analytics aggregated successfully",
      data: analytics,
    });
  },
);

const getAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as unknown as AuditLogQueryInput;
  const result = await AdminService.getAuditLogs(query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Audit logs retrieved successfully",
    data: result,
  });
});

export const AdminController = {
  getUsers,
  updateUserStatus,
  updateUserRole,
  getPlatformOverviewAnalytics,
  getAuditLogs,
};
