import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { AppError } from "../../utils/AppError.js";
import { UtilityService } from "./utility.service.js";
import type { UtilityQueryInput } from "./utility.validation.js";

const createUtilityBill = catchAsync(async (req: Request, res: Response) => {
	if (!req.user?.userId || !req.user?.role) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Authentication credentials required",
		);
	}

	const ipAddress = req.ip || req.socket.remoteAddress;
	const bill = await UtilityService.createUtilityBill(
		req.user.userId,
		req.user.role,
		req.body,
		ipAddress,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Utility bill issued and precision-split among active tenants",
		data: bill,
	});
});

const getMySplits = catchAsync(async (req: Request, res: Response) => {
	if (!req.user?.userId) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Authentication credentials required",
		);
	}

	const query = req.query as unknown as UtilityQueryInput;
	const result = await UtilityService.getMySplits(req.user.userId, query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Utility bill shares retrieved successfully",
		data: result,
	});
});

const getUnitBills = catchAsync(async (req: Request, res: Response) => {
	if (!req.user?.userId || !req.user?.role) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Authentication credentials required",
		);
	}

	const { unitId } = req.params;
	if (!unitId || typeof unitId !== "string") {
		throw new AppError(httpStatus.BAD_REQUEST, "A valid Unit ID is required");
	}

	const query = req.query as unknown as UtilityQueryInput;
	const result = await UtilityService.getUnitBills(
		unitId,
		req.user.userId,
		req.user.role,
		query,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Unit utility bill ledger retrieved successfully",
		data: result,
	});
});

const settleSplit = catchAsync(async (req: Request, res: Response) => {
	if (!req.user?.userId || !req.user?.role) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Authentication credentials required",
		);
	}

	const { id } = req.params;
	if (!id || typeof id !== "string") {
		throw new AppError(httpStatus.BAD_REQUEST, "A valid Split ID is required");
	}

	const ipAddress = req.ip || req.socket.remoteAddress;
	const settled = await UtilityService.settleSplit(
		id,
		req.user.userId,
		req.user.role,
		ipAddress,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Utility bill share settled successfully",
		data: settled,
	});
});

export const UtilityController = {
	createUtilityBill,
	getMySplits,
	getUnitBills,
	settleSplit,
};
