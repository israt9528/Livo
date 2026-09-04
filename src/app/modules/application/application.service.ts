import httpStatus from "http-status";
import { ApplicationStatus, RoomStatus, UserRole } from "../../lib/prisma";
import { AppError } from "../../utils/AppError.js";
import { PaginationUtils } from "../../utils/pagination.js";
import {
  CreateApplicationInput,
  UpdateApplicationStatusInput,
  ApplicationQueryInput,
} from "./application.validation.js";
import { prisma } from "../../lib/prisma.js";

const createApplication = async (
  tenantId: string,
  payload: CreateApplicationInput,
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

  // Room must be currently available
  if (room.status !== RoomStatus.AVAILABLE) {
    throw new AppError(
      httpStatus.CONFLICT,
      `Cannot apply for this room: Current room status is ${room.status.toLowerCase()}`,
    );
  }

  // Prevent duplicate active applications by the same tenant for the same room
  const existingApplication = await prisma.application.findFirst({
    where: {
      tenantId,
      roomId: payload.roomId,
      status: {
        in: [ApplicationStatus.PENDING, ApplicationStatus.APPROVED],
      },
    },
  });

  if (existingApplication) {
    throw new AppError(
      httpStatus.CONFLICT,
      `You already have an active application (${existingApplication.status.toLowerCase()}) for this room.`,
    );
  }

  const application = await prisma.$transaction(async (tx) => {
    const newApp = await tx.application.create({
      data: {
        tenantId,
        roomId: payload.roomId,
        moveInDate: new Date(payload.moveInDate),
        intendedDurationMonths: payload.intendedDurationMonths,
        incomeVerificationUrl: payload.incomeVerificationUrl ?? null,
        status: ApplicationStatus.PENDING,
      },
      include: {
        room: {
          select: {
            id: true,
            roomNumber: true,
            rentAmount: true,
            depositAmount: true,
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
        action: "APPLICATION_SUBMITTED",
        resource: "applications",
        resourceId: newApp.id,
        newValue: {
          roomId: newApp.roomId,
          moveInDate: newApp.moveInDate,
          duration: newApp.intendedDurationMonths,
        },
        ipAddress: ipAddress ?? null,
      },
    });

    return newApp;
  });

  return application;
};

const getApplications = async (
  userId: string,
  userRole: UserRole,
  query: ApplicationQueryInput,
) => {
  const { page, limit, skip, take, sortBy, sortOrder } =
    PaginationUtils.calculatePagination(query, "createdAt");

  let roleCondition: Record<string, unknown> = {};

  if (userRole === UserRole.TENANT) {
    roleCondition = { tenantId: userId };
  } else if (userRole === UserRole.OWNER) {
    roleCondition = {
      room: {
        unit: {
          property: {
            ownerId: userId,
          },
        },
      },
    };
  }

  const whereClause = {
    ...roleCondition,
    ...(query.status && { status: query.status }),
  };

  const [total, applications] = await Promise.all([
    prisma.application.count({ where: whereClause }),
    prisma.application.findMany({
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
            reservationExpiresAt: true,
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
    applications,
  };
};

const getApplicationById = async (
  applicationId: string,
  userId: string,
  userRole: UserRole,
) => {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          avatarUrl: true,
          bio: true,
        },
      },
      room: {
        include: {
          unit: {
            include: {
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
  });

  if (!application || application.deletedAt !== null) {
    throw new AppError(httpStatus.NOT_FOUND, "Application not found");
  }

  const isTenant = application.tenantId === userId;
  const isOwner = application.room.unit.property.ownerId === userId;
  const isAdmin = userRole === UserRole.ADMIN;

  if (!isTenant && !isOwner && !isAdmin) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Forbidden: You are not authorized to view this application",
    );
  }

  return application;
};

/**
 * [✨ UNIQUE IMPLEMENTATION / VALUE-ADD]
 * Atomic status transition with 24-hour occupancy reservation lock
 */
const updateApplicationStatus = async (
  applicationId: string,
  userId: string,
  userRole: UserRole,
  payload: UpdateApplicationStatusInput,
  ipAddress?: string,
) => {
  const existingApp = await prisma.application.findUnique({
    where: { id: applicationId },
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

  if (!existingApp || existingApp.deletedAt !== null) {
    throw new AppError(httpStatus.NOT_FOUND, "Application not found");
  }

  const isOwner = existingApp.room.unit.property.ownerId === userId;
  const isTenant = existingApp.tenantId === userId;
  const isAdmin = userRole === UserRole.ADMIN;

  // Authorization checks
  if (isTenant && !isOwner && !isAdmin) {
    if (payload.status !== ApplicationStatus.CANCELLED) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Tenants are only permitted to cancel their own application",
      );
    }
  } else if (!isOwner && !isAdmin) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Forbidden: You are not authorized to review this application",
    );
  }

  // Prevent modifying applications in terminal state
  if (
    existingApp.status === ApplicationStatus.COMPLETED ||
    existingApp.status === ApplicationStatus.REJECTED ||
    existingApp.status === ApplicationStatus.CANCELLED
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot change status of an application that is already ${existingApp.status.toLowerCase()}`,
    );
  }

  // Atomic state change with reservation lock
  const updatedApplication = await prisma.$transaction(async (tx) => {
    // 1. Handling APPROVAL: Lock the room
    if (payload.status === ApplicationStatus.APPROVED) {
      const targetRoom = await tx.room.findUnique({
        where: { id: existingApp.roomId },
      });

      if (!targetRoom) {
        throw new AppError(httpStatus.NOT_FOUND, "Associated room not found");
      }

      // Check if room is still AVAILABLE
      if (targetRoom.status !== RoomStatus.AVAILABLE) {
        throw new AppError(
          httpStatus.CONFLICT,
          `Cannot approve: Room is currently ${targetRoom.status.toLowerCase()}. Another tenant may have reserved or occupied it.`,
        );
      }

      // Set 24-hour expiration lock on room
      const reservationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await tx.room.update({
        where: { id: existingApp.roomId },
        data: {
          status: RoomStatus.RESERVED,
          reservationExpiresAt,
        },
      });
    }

    // 2. Handling REJECTION or CANCELLATION: Release room lock if it was previously approved
    if (
      (payload.status === ApplicationStatus.REJECTED ||
        payload.status === ApplicationStatus.CANCELLED) &&
      existingApp.status === ApplicationStatus.APPROVED
    ) {
      await tx.room.update({
        where: { id: existingApp.roomId },
        data: {
          status: RoomStatus.AVAILABLE,
          reservationExpiresAt: null,
        },
      });
    }

    // 3. Update the application record
    const updated = await tx.application.update({
      where: { id: applicationId },
      data: {
        status: payload.status,
        ...(payload.rejectionReason !== undefined && {
          rejectionReason: payload.rejectionReason,
        }),
      },
      include: {
        room: {
          select: {
            id: true,
            roomNumber: true,
            status: true,
            reservationExpiresAt: true,
          },
        },
        tenant: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // 4. Record audit entry
    await tx.auditLog.create({
      data: {
        userId,
        action: "APPLICATION_STATUS_UPDATED",
        resource: "applications",
        resourceId: applicationId,
        oldValue: {
          status: existingApp.status,
          rejectionReason: existingApp.rejectionReason,
        },
        newValue: {
          status: payload.status,
          rejectionReason: payload.rejectionReason,
        },
        ipAddress: ipAddress ?? null,
      },
    });

    return updated;
  });

  return updatedApplication;
};

export const ApplicationService = {
  createApplication,
  getApplications,
  getApplicationById,
  updateApplicationStatus,
};
