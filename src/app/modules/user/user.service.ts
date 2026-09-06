import httpStatus from "http-status";
import { UserStatus } from "../../../generated/prisma/client";
import { AppError } from "../../utils/AppError.js";
import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
} from "../../utils/cloudinaryUpload.js";
import type { UpdateProfileInput } from "./user.validation.js";
import { prisma } from "../../lib/prisma.js";

const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      phoneNumber: true,
      avatarUrl: true,
      bio: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      preference: {
        select: {
          id: true,
          budgetMin: true,
          budgetMax: true,
          cleanlinessLevel: true,
          sleepSchedule: true,
          smokingAllowed: true,
          petsAllowed: true,
          preferredLocations: true,
        },
      },
    },
  });

  if (!user || user.deletedAt !== null) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "User profile not found or has been deactivated.",
    );
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `Your account has been ${user.status.toLowerCase()}. Please contact support.`,
    );
  }

  const { deletedAt: _deletedAt, ...sanitizedUser } = user;
  return sanitizedUser;
};

const updateMe = async (
  userId: string,
  payload: UpdateProfileInput,
  ipAddress?: string,
) => {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      avatarUrl: true,
      bio: true,
      status: true,
      deletedAt: true,
    },
  });

  if (!existingUser || existingUser.deletedAt !== null) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "User profile not found or has been deactivated.",
    );
  }

  if (existingUser.status !== UserStatus.ACTIVE) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `Cannot update profile: Account is ${existingUser.status.toLowerCase()}.`,
    );
  }

  const previousState = {
    name: existingUser.name,
    phoneNumber: existingUser.phoneNumber,
    avatarUrl: existingUser.avatarUrl,
    bio: existingUser.bio,
  };

  const updatedUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        ...(payload.name !== undefined && { name: payload.name }),
        ...(payload.phoneNumber !== undefined && {
          phoneNumber: payload.phoneNumber,
        }),
        ...(payload.avatarUrl !== undefined && {
          avatarUrl: payload.avatarUrl,
        }),
        ...(payload.bio !== undefined && { bio: payload.bio }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        phoneNumber: true,
        avatarUrl: true,
        bio: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: "PROFILE_UPDATED",
        resource: "users",
        resourceId: userId,
        oldValue: previousState,
        newValue: payload,
        ipAddress: ipAddress ?? null,
      },
    });

    return user;
  });

  return updatedUser;
};

const uploadAvatar = async (
  userId: string,
  file?: Express.Multer.File,
  ipAddress?: string,
) => {
  if (!file) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Please provide an image file in form-data under field name "image"',
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      avatarUrl: true,
      status: true,
      deletedAt: true,
    },
  });

  if (!existingUser || existingUser.deletedAt !== null) {
    throw new AppError(httpStatus.NOT_FOUND, "User profile not found");
  }

  if (existingUser.status !== UserStatus.ACTIVE) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `Account is ${existingUser.status.toLowerCase()}`,
    );
  }

  // 1. Upload new avatar buffer to Cloudinary
  const newAvatarUrl = await uploadBufferToCloudinary(file.buffer, "avatars");

  // 2. Delete previous Cloudinary image if one exists
  if (existingUser.avatarUrl) {
    await deleteFromCloudinary(existingUser.avatarUrl);
  }

  // 3. Persist new avatarUrl to PostgreSQL
  const updatedUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { avatarUrl: newAvatarUrl },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: "AVATAR_UPLOADED",
        resource: "users",
        resourceId: userId,
        oldValue: { avatarUrl: existingUser.avatarUrl },
        newValue: { avatarUrl: newAvatarUrl },
        ipAddress: ipAddress ?? null,
      },
    });

    return user;
  });

  return updatedUser;
};

export const UserService = {
  getMe,
  updateMe,
  uploadAvatar,
};
