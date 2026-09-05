import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { AppError } from "../../utils/AppError.js";
import { LeaseService } from "./lease.service.js";

const createLease = catchAsync(async (req: Request, res: Response) => {
	if (!req.user?.userId || !req.user?.role) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Authentication credentials required",
		);
	}

	const ipAddress = req.ip || req.socket.remoteAddress;
	const lease = await LeaseService.createLease(
		req.user.userId,
		req.user.role,
		req.body,
		ipAddress,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Lease agreement activated successfully and room marked OCCUPIED",
		data: lease,
	});
});

const getMyLease = catchAsync(async (req: Request, res: Response) => {
	if (!req.user?.userId) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Authentication credentials required",
		);
	}

	const result = await LeaseService.getMyLease(req.user.userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message:
			"Active lease details and co-occupant roster retrieved successfully",
		data: result,
	});
});

const getLeaseById = catchAsync(async (req: Request, res: Response) => {
	if (!req.user?.userId || !req.user?.role) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Authentication credentials required",
		);
	}

	const { id } = req.params;
	if (!id || typeof id !== "string") {
		throw new AppError(httpStatus.BAD_REQUEST, "A valid Lease ID is required");
	}

	const lease = await LeaseService.getLeaseById(
		id,
		req.user.userId,
		req.user.role,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Lease details retrieved successfully",
		data: lease,
	});
});

const terminateLease = catchAsync(async (req: Request, res: Response) => {
	if (!req.user?.userId || !req.user?.role) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Authentication credentials required",
		);
	}

	const { id } = req.params;
	if (!id || typeof id !== "string") {
		throw new AppError(httpStatus.BAD_REQUEST, "A valid Lease ID is required");
	}

	const ipAddress = req.ip || req.socket.remoteAddress;
	const terminatedLease = await LeaseService.terminateLease(
		id,
		req.user.userId,
		req.user.role,
		req.body,
		ipAddress,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message:
			"Lease agreement terminated successfully and room restored to AVAILABLE",
		data: terminatedLease,
	});
});

export const LeaseController = {
	createLease,
	getMyLease,
	getLeaseById,
	terminateLease,
};
