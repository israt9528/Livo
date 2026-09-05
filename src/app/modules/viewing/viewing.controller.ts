import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { AppError } from "../../utils/AppError.js";
import { ViewingService } from "./viewing.service.js";
import type { ViewingQueryInput } from "./viewing.validation.js";

const createViewingRequest = catchAsync(async (req: Request, res: Response) => {
	if (!req.user?.userId) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Authentication credentials required",
		);
	}

	const ipAddress = req.ip || req.socket.remoteAddress;
	const viewing = await ViewingService.createViewingRequest(
		req.user.userId,
		req.body,
		ipAddress,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Viewing request scheduled successfully",
		data: viewing,
	});
});

const getViewingRequests = catchAsync(async (req: Request, res: Response) => {
	if (!req.user?.userId || !req.user?.role) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Authentication credentials required",
		);
	}

	const query = req.query as unknown as ViewingQueryInput;
	const result = await ViewingService.getViewingRequests(
		req.user.userId,
		req.user.role,
		query,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Viewing requests retrieved successfully",
		data: result,
	});
});

const updateViewingStatus = catchAsync(async (req: Request, res: Response) => {
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
			"A valid Viewing Request ID is required",
		);
	}

	const ipAddress = req.ip || req.socket.remoteAddress;
	const updatedViewing = await ViewingService.updateViewingStatus(
		id,
		req.user.userId,
		req.user.role,
		req.body,
		ipAddress,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: `Viewing request status updated to ${req.body.status}`,
		data: updatedViewing,
	});
});

export const ViewingController = {
	createViewingRequest,
	getViewingRequests,
	updateViewingStatus,
};
