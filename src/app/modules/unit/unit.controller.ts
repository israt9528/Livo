import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { AppError } from "../../utils/AppError.js";
import { UnitService } from "./unit.service.js";

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

export const UnitController = {
	createUnit,
};
