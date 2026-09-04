import type { Request, Response } from "express";
import { Readable } from "stream";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { AppError } from "../../utils/AppError.js";
import { cloudinary } from "../../lib/cloudinary.js";

const uploadToCloudinary = (
	buffer: Buffer,
	folder: string,
): Promise<string> => {
	return new Promise((resolve, reject) => {
		const uploadStream = cloudinary.uploader.upload_stream(
			{
				folder: `housing-platform/${folder}`,
				resource_type: "image",
			},
			(error, result) => {
				if (error || !result) {
					return reject(
						new AppError(
							httpStatus.BAD_GATEWAY,
							"Failed to upload image to Cloudinary",
						),
					);
				}
				resolve(result.secure_url);
			},
		);

		Readable.from(buffer).pipe(uploadStream);
	});
};

const uploadSingle = catchAsync(async (req: Request, res: Response) => {
	if (!req.file) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			'Please provide an image file in form-data under field name "image"',
		);
	}

	const url = await uploadToCloudinary(req.file.buffer, "listings");

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Image uploaded successfully",
		data: { url },
	});
});

export const MediaController = {
	uploadSingle,
};
