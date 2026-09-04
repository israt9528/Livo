import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { AppError } from "../../utils/AppError.js";
import { PropertyService } from "./property.service.js";
import type { PropertyQueryInput } from "./property.validation.js";

const createProperty = catchAsync(async (req: Request, res: Response) => {
	if (!req.user?.userId) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Authentication credentials required",
		);
	}

	const ipAddress = req.ip || req.socket.remoteAddress;
	const property = await PropertyService.createProperty(
		req.user.userId,
		req.body,
		ipAddress,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Property listing created successfully",
		data: property,
	});
});

const getProperties = catchAsync(async (req: Request, res: Response) => {
	const query = req.query as unknown as PropertyQueryInput;
	const result = await PropertyService.getProperties(query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Properties retrieved successfully",
		data: result,
	});
});

const getPropertyById = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params;
	if (!id || typeof id !== "string") {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"A valid Property ID is required",
		);
	}

	const property = await PropertyService.getPropertyById(id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Property details retrieved successfully",
		data: property,
	});
});

const updateProperty = catchAsync(async (req: Request, res: Response) => {
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
			"A valid Property ID is required",
		);
	}

	const ipAddress = req.ip || req.socket.remoteAddress;
	const updatedProperty = await PropertyService.updateProperty(
		id,
		req.user.userId,
		req.user.role,
		req.body,
		ipAddress,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Property listing updated successfully",
		data: updatedProperty,
	});
});

const deleteProperty = catchAsync(async (req: Request, res: Response) => {
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
			"A valid Property ID is required",
		);
	}

	const ipAddress = req.ip || req.socket.remoteAddress;
	await PropertyService.deleteProperty(
		id,
		req.user.userId,
		req.user.role,
		ipAddress,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Property listing soft-deleted successfully",
		data: null,
	});
});

export const PropertyController = {
	createProperty,
	getProperties,
	getPropertyById,
	updateProperty,
	deleteProperty,
};
