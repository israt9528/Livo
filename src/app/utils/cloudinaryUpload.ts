import { Readable } from "stream";
import httpStatus from "http-status";
import { cloudinary } from "../lib/cloudinary.js";
import { AppError } from "./AppError.js";

export const uploadBufferToCloudinary = (
  buffer: Buffer,
  folder: string,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    console.log("Cloudinary Config Loaded:", {
      cloud_name: cloudinary.config().cloud_name,
      api_key: cloudinary.config().api_key
        ? "EXISTS (Starts with " +
          String(cloudinary.config().api_key).slice(0, 4) +
          "...)"
        : "MISSING",
      api_secret: cloudinary.config().api_secret ? "EXISTS" : "MISSING",
    });
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `housing-platform/${folder}`,
        resource_type: "image",
      },
      (error, result) => {
        if (error || !result) {
          console.error(
            "RAW CLOUDINARY ERROR:",
            JSON.stringify(error, null, 2),
          );
          return reject(
            new AppError(
              httpStatus.BAD_GATEWAY,
              `Cloudinary upload failed: ${error?.message || "Unknown error"}`,
            ),
          );
        }
        resolve(result.secure_url);
      },
    );

    Readable.from(buffer).pipe(uploadStream);
  });
};

export const uploadMultipleBuffersToCloudinary = async (
  files: Express.Multer.File[],
  folder: string,
): Promise<string[]> => {
  const uploadPromises = files.map((file) =>
    uploadBufferToCloudinary(file.buffer, folder),
  );
  return Promise.all(uploadPromises);
};
