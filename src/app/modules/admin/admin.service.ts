import httpStatus from "http-status";
import { AppError } from "../../utils/AppError.js";
import { PaginationUtils } from "../../utils/pagination.js";
import { SearchUtils } from "../../utils/searchFilter.js";
import {
  AdminUserQueryInput,
  AuditLogQueryInput,
  UpdateUserRoleInput,
  UpdateUserStatusInput,
} from "./admin.validation.js";
import {
  ApplicationStatus,
  LeaseStatus,
  PaymentCategory,
  PaymentStatus,
  prisma,
  RoomStatus,
  UserRole,
  UserStatus,
  ViewingStatus,
} from "../../lib/prisma.js";

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
const getPlatformOverviewAnalytics = async () => {
  const [
    userStats,
    roomStats,
    propertyCount,
    unitCount,
    activeLeasesCount,
    pendingApplicationsCount,
    pendingViewingsCount,
    revenueAggregates,
    revenueByCategory,
  ] = await Promise.all([
    // 1. User counts grouped by role
    prisma.user.groupBy({
      by: ["role"],
      _count: { _all: true },
    }),

    // 2. Room counts grouped by inventory status
    prisma.room.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),

    // 3. Total property count
    prisma.property.count(),

    // 4. Total unit count
    prisma.unit.count(),

    // 5. Active lease count
    prisma.lease.count({
      where: { status: LeaseStatus.ACTIVE },
    }),

    // 6. Pending tenant applications
    prisma.application.count({
      where: { status: ApplicationStatus.PENDING },
    }),

    // 7. Pending tour viewing requests
    prisma.viewingRequest.count({
      where: { status: ViewingStatus.PENDING },
    }),

    // 8. Total gross volume settled
    prisma.paymentTransaction.aggregate({
      where: { status: PaymentStatus.SUCCESS },
      _sum: { amount: true },
      _count: { _all: true },
    }),

    // 9. Volume settled grouped by payment category
    prisma.paymentTransaction.groupBy({
      by: ["category"],
      where: { status: PaymentStatus.SUCCESS },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  // Transform User Stats
  const usersByRole = {
    tenants:
      userStats.find((u) => u.role === UserRole.TENANT)?._count._all ?? 0,
    owners: userStats.find((u) => u.role === UserRole.OWNER)?._count._all ?? 0,
    admins: userStats.find((u) => u.role === UserRole.ADMIN)?._count._all ?? 0,
    total: userStats.reduce((acc, curr) => acc + curr._count._all, 0),
  };

  // Transform Room & Occupancy Stats
  const totalRooms = roomStats.reduce((acc, curr) => acc + curr._count._all, 0);
  const occupiedRooms =
    roomStats.find((r) => r.status === RoomStatus.OCCUPIED)?._count._all ?? 0;
  const reservedRooms =
    roomStats.find((r) => r.status === RoomStatus.RESERVED)?._count._all ?? 0;
  const availableRooms =
    roomStats.find((r) => r.status === RoomStatus.AVAILABLE)?._count._all ?? 0;
  const maintenanceRooms =
    roomStats.find((r) => r.status === RoomStatus.MAINTENANCE)?._count._all ??
    0;

  const occupancyRate =
    totalRooms > 0
      ? Number(((occupiedRooms / totalRooms) * 100).toFixed(2))
      : 0;

  // Transform Financial Breakdown
  const financialSummary = {
    grossVolume: Number(revenueAggregates._sum.amount ?? 0),
    successfulTransactionsCount: revenueAggregates._count._all,
    byCategory: {
      monthlyRent: Number(
        revenueByCategory.find(
          (c) => c.category === PaymentCategory.MONTHLY_RENT,
        )?._sum.amount ?? 0,
      ),
      securityDeposit: Number(
        revenueByCategory.find(
          (c) => c.category === PaymentCategory.SECURITY_DEPOSIT,
        )?._sum.amount ?? 0,
      ),
      utilitySplit: Number(
        revenueByCategory.find(
          (c) => c.category === PaymentCategory.UTILITY_SPLIT,
        )?._sum.amount ?? 0,
      ),
    },
  };

  return {
    overview: {
      generatedAt: new Date().toISOString(),
      occupancyRatePercent: occupancyRate,
    },
    users: usersByRole,
    inventory: {
      properties: propertyCount,
      units: unitCount,
      rooms: {
        total: totalRooms,
        available: availableRooms,
        reserved: reservedRooms,
        occupied: occupiedRooms,
        maintenance: maintenanceRooms,
      },
    },
    operations: {
      activeLeases: activeLeasesCount,
      pendingApplications: pendingApplicationsCount,
      pendingViewingRequests: pendingViewingsCount,
    },
    financials: financialSummary,
  };
};

/**
 * Filterable, paginated audit trail explorer
 */
const getAuditLogs = async (query: AuditLogQueryInput) => {
  const { page, limit, skip, take, sortBy, sortOrder } =
    PaginationUtils.calculatePagination(query, "createdAt");

  const whereClause: Record<string, unknown> = {
    ...(query.action && {
      action: { contains: query.action, mode: "insensitive" },
    }),
    ...(query.resource && {
      resource: { equals: query.resource, mode: "insensitive" },
    }),
    ...(query.userId && { userId: query.userId }),
    ...((query.startDate || query.endDate) && {
      createdAt: {
        ...(query.startDate && { gte: new Date(query.startDate) }),
        ...(query.endDate && { lte: new Date(query.endDate) }),
      },
    }),
  };

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where: whereClause }),
    prisma.auditLog.findMany({
      where: whereClause,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    }),
  ]);

  const meta = PaginationUtils.formatPaginationMeta(total, page, limit);

  return { meta, logs };
};

export const AdminService = {
  getUsers,
  updateUserStatus,
  updateUserRole,
  getPlatformOverviewAnalytics,
  getAuditLogs,
};
