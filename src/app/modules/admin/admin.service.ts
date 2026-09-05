import httpStatus from "http-status";
import { AppError } from "../../utils/AppError.js";
import { PaginationUtils } from "../../utils/pagination.js";
import { SearchUtils } from "../../utils/searchFilter.js";
import {
  AdminUserQueryInput,
  UpdateUserRoleInput,
  UpdateUserStatusInput,
} from "./admin.validation.js";
import { prisma, UserStatus } from "../../lib/prisma.js";

const getUsers = async (query: AdminUserQueryInput) => {
  const { page, limit, skip, take, sortBy, sortOrder } =
    PaginationUtils.calculatePagination(query, "createdAt");

  const whereClause = SearchUtils.buildWhereClause({
    searchTerm: query.q,
    searchableFields: ["name", "email", "phoneNumber"],
    filters: {
      ...(query.role && { role: query.role }),
      ...(query.status && { status: query.status }),
    },
  });

  const [total, users] = await Promise.all([
    prisma.user.count({ where: whereClause }),
    prisma.user.findMany({
      where: whereClause,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        avatarUrl: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const meta = PaginationUtils.formatPaginationMeta(total, page, limit);

  return {
    meta,
    users,
  };
};

const updateUserStatus = async (
  targetUserId: string,
  adminId: string,
  payload: UpdateUserStatusInput,
  ipAddress?: string,
) => {
  // Self-action guard: Admins cannot suspend or deactivate their own account
  if (targetUserId === adminId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Operation rejected: You cannot suspend or deactivate your own administrative account.",
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true, status: true, deletedAt: true },
  });

  if (!existingUser || existingUser.deletedAt !== null) {
    throw new AppError(httpStatus.NOT_FOUND, "Target user not found");
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    // If account is suspended or deactivated, nullify refreshTokenHash to invalidate active sessions
    const shouldRevokeTokens =
      payload.status === UserStatus.SUSPENDED ||
      payload.status === UserStatus.DEACTIVATED;

    const user = await tx.user.update({
      where: { id: targetUserId },
      data: {
        status: payload.status,
        ...(shouldRevokeTokens && { refreshTokenHash: null }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: "ADMIN_USER_STATUS_UPDATED",
        resource: "users",
        resourceId: targetUserId,
        oldValue: { status: existingUser.status },
        newValue: { status: payload.status, reason: payload.reason ?? null },
        ipAddress: ipAddress ?? null,
      },
    });

    return user;
  });

  return updatedUser;
};

const updateUserRole = async (
  targetUserId: string,
  adminId: string,
  payload: UpdateUserRoleInput,
  ipAddress?: string,
) => {
  // Self-action guard: Admins cannot modify their own role
  if (targetUserId === adminId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Operation rejected: You cannot modify your own administrative role.",
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true, role: true, deletedAt: true },
  });

  if (!existingUser || existingUser.deletedAt !== null) {
    throw new AppError(httpStatus.NOT_FOUND, "Target user not found");
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: targetUserId },
      data: {
        role: payload.role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: "ADMIN_USER_ROLE_UPDATED",
        resource: "users",
        resourceId: targetUserId,
        oldValue: { role: existingUser.role },
        newValue: { role: payload.role },
        ipAddress: ipAddress ?? null,
      },
    });

    return user;
  });

  return updatedUser;
};

export const AdminService = {
  getUsers,
  updateUserStatus,
  updateUserRole,
};
