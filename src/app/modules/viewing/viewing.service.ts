import httpStatus from "http-status";
import { AppError } from "../../utils/AppError.js";
import { PaginationUtils } from "../../utils/pagination.js";
import {
  CreateViewingRequestInput,
  UpdateViewingStatusInput,
  ViewingQueryInput,
} from "./viewing.validation.js";
import { prisma, UserRole, ViewingStatus } from "../../lib/prisma.js";

const createViewingRequest = async (
  tenantId: string,
  payload: CreateViewingRequestInput,
  ipAddress?: string,
) => {
  const room = await prisma.room.findUnique({
    where: { id: payload.roomId },
    include: {
      unit: {
        include: { property: true },
      },
    },
  });

  if (
    !room ||
    room.deletedAt !== null ||
    room.unit.deletedAt !== null ||
    room.unit.property.deletedAt !== null
  ) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Target room not found or property is inactive",
    );
  }

  // Prevent duplicate pending viewing appointments for the same room by the same tenant
  const existingPending = await prisma.viewingRequest.findFirst({
    where: {
      tenantId,
      roomId: payload.roomId,
      status: ViewingStatus.PENDING,
    },
  });

  if (existingPending) {
    throw new AppError(
      httpStatus.CONFLICT,
      "You already have a pending viewing request for this room. Please wait for owner confirmation.",
    );
  }

  const viewing = await prisma.$transaction(async (tx) => {
    const newViewing = await tx.viewingRequest.create({
      data: {
        tenantId,
        roomId: payload.roomId,
        preferredDate: new Date(payload.preferredDate),
        note: payload.note ?? null,
        status: ViewingStatus.PENDING,
      },
      include: {
        room: {
          select: {
            id: true,
            roomNumber: true,
            rentAmount: true,
            unit: {
              select: {
                unitNumber: true,
                property: {
                  select: {
                    id: true,
                    title: true,
                    address: true,
                    city: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: tenantId,
        action: "VIEWING_REQUEST_CREATED",
        resource: "viewing_requests",
        resourceId: newViewing.id,
        newValue: {
          roomId: newViewing.roomId,
          preferredDate: newViewing.preferredDate,
        },
        ipAddress: ipAddress ?? null,
      },
    });

    return newViewing;
  });

  return viewing;
};

const getViewingRequests = async (
  userId: string,
  userRole: UserRole,
  query: ViewingQueryInput,
) => {
  const { page, limit, skip, take, sortBy, sortOrder } =
    PaginationUtils.calculatePagination(query, "createdAt");

  // Role-based where clause construction
  let roleWhereCondition: Record<string, unknown> = {};

  if (userRole === UserRole.TENANT) {
    // Tenants only view their own requests
    roleWhereCondition = { tenantId: userId };
  } else if (userRole === UserRole.OWNER) {
    // Owners view requests for rooms belonging to their properties
    roleWhereCondition = {
      room: {
        unit: {
          property: {
            ownerId: userId,
          },
        },
      },
    };
  }
  // Admins have unrestricted access (no roleWhereCondition override needed)

  const whereClause = {
    ...roleWhereCondition,
    ...(query.status && { status: query.status }),
  };

  const [total, requests] = await Promise.all([
    prisma.viewingRequest.count({ where: whereClause }),
    prisma.viewingRequest.findMany({
      where: whereClause,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            avatarUrl: true,
          },
        },
        room: {
          select: {
            id: true,
            roomNumber: true,
            rentAmount: true,
            depositAmount: true,
            status: true,
            unit: {
              select: {
                unitNumber: true,
                property: {
                  select: {
                    id: true,
                    title: true,
                    address: true,
                    city: true,
                    ownerId: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const meta = PaginationUtils.formatPaginationMeta(total, page, limit);

  return {
    meta,
    requests,
  };
};

const updateViewingStatus = async (
  viewingId: string,
  userId: string,
  userRole: UserRole,
  payload: UpdateViewingStatusInput,
  ipAddress?: string,
) => {
  const existingViewing = await prisma.viewingRequest.findUnique({
    where: { id: viewingId },
    include: {
      room: {
        include: {
          unit: {
            include: { property: true },
          },
        },
      },
    },
  });

  if (!existingViewing) {
    throw new AppError(httpStatus.NOT_FOUND, "Viewing request not found");
  }

  const isOwner = existingViewing.room.unit.property.ownerId === userId;
  const isTenant = existingViewing.tenantId === userId;
  const isAdmin = userRole === UserRole.ADMIN;

  // Authorization rules:
  // 1. Tenant can ONLY change status to CANCELLED on their own request
  // 2. Owner can change status to CONFIRMED, REJECTED, or CANCELLED
  // 3. Admin can perform any transition
  if (isTenant && !isOwner && !isAdmin) {
    if (payload.status !== ViewingStatus.CANCELLED) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Tenants are only permitted to cancel their own viewing requests",
      );
    }
  } else if (!isOwner && !isAdmin) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Forbidden: You are not authorized to update this viewing request",
    );
  }

  // Prevent transitions on already terminal requests
  if (
    existingViewing.status === ViewingStatus.CANCELLED ||
    existingViewing.status === ViewingStatus.REJECTED
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot change status of an appointment that is already ${existingViewing.status.toLowerCase()}`,
    );
  }

  const updatedViewing = await prisma.$transaction(async (tx) => {
    const updated = await tx.viewingRequest.update({
      where: { id: viewingId },
      data: {
        status: payload.status,
        ...(payload.note !== undefined && { note: payload.note }),
      },
      include: {
        tenant: {
          select: { id: true, name: true, email: true },
        },
        room: {
          select: { id: true, roomNumber: true },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: "VIEWING_STATUS_UPDATED",
        resource: "viewing_requests",
        resourceId: viewingId,
        oldValue: {
          status: existingViewing.status,
          note: existingViewing.note,
        },
        newValue: { status: payload.status, note: payload.note },
        ipAddress: ipAddress ?? null,
      },
    });

    return updated;
  });

  return updatedViewing;
};

export const ViewingService = {
  createViewingRequest,
  getViewingRequests,
  updateViewingStatus,
};
