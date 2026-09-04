import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { AppError } from "../../utils/AppError.js";
import { RoommateService } from "./roommate.service.js";
import type { RoommateMatchQueryInput } from "./roommate.validation.js";

const upsertPreference = catchAsync(async (req: Request, res: Response) => {
  if (!req.user?.userId) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Authentication credentials required",
    );
  }

  const preference = await RoommateService.upsertPreference(
    req.user.userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Roommate preferences saved successfully",
    data: preference,
  });
});

const getMatches = catchAsync(async (req: Request, res: Response) => {
  if (!req.user?.userId) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Authentication credentials required",
    );
  }

  const queryParams: RoommateMatchQueryInput = {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,
    minScore:
      req.query.minScore !== undefined ? Number(req.query.minScore) : 50,
  };

  const results = await RoommateService.findMatches(
    req.user.userId,
    queryParams,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Roommate matches computed and retrieved successfully",
    data: results,
  });
});

export const RoommateController = {
  upsertPreference,
  getMatches,
};
