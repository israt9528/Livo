import { Readable } from "stream";
import httpStatus from "http-status";
import { cloudinary } from "../lib/cloudinary.js";
import { AppError } from "./AppError.js";

export const uploadBufferToCloudinary = (
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

/**
 * Extracts public_id from Cloudinary CDN URL
 * E.g. https://res.cloudinary.com/.../upload/v123456/housing-platform/avatars/abc.jpg
 * Returns: "housing-platform/avatars/abc"
 */
export const extractCloudinaryPublicId = (url: string): string | null => {
  try {
    if (!url || !url.includes("cloudinary.com")) return null;
    const parts = url.split(/\/upload\/(?:v\d+\/)?/);
    if (parts.length < 2) return null;
    const pathWithExt = parts[1];
    const lastDotIndex = pathWithExt.lastIndexOf(".");
    return lastDotIndex !== -1
      ? pathWithExt.substring(0, lastDotIndex)
      : pathWithExt;
  } catch {
    return null;
  }
};

/**
 * Removes an image asset from Cloudinary storage
 */
export const deleteFromCloudinary = async (url: string): Promise<void> => {
  const publicId = extractCloudinaryPublicId(url);
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    // Non-blocking error so an orphaned asset cleanup does not fail the primary upload flow
    console.error(
      `Failed to delete asset [${publicId}] from Cloudinary:`,
      error,
    );
  }
};
