import multer from "multer";
import httpStatus from "http-status";
import { AppError } from "../utils/AppError.js";

const storage = multer.memoryStorage();

const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

export const uploadSingleImage = multer({
	storage,
	limits: {
		fileSize: 5 * 1024 * 1024, // 5MB limit
	},
	fileFilter: (_req, file, cb) => {
		if (allowedMimeTypes.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(
				new AppError(
					httpStatus.BAD_REQUEST,
					"Invalid file type. Only JPG, PNG, and WebP images are allowed.",
				),
			);
		}
	},
}).single("image");

export const uploadMultipleImages = multer({
	storage,
	limits: {
		fileSize: 5 * 1024 * 1024, // 5MB per file
	},
	fileFilter: (_req, file, cb) => {
		if (allowedMimeTypes.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(
				new AppError(
					httpStatus.BAD_REQUEST,
					"Invalid file type. Only JPG, PNG, and WebP images are allowed.",
				),
			);
		}
	},
}).array("images", 5); // Max 5 images per request
