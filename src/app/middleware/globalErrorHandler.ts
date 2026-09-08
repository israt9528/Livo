import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { ZodError } from "zod";
import { Prisma } from "../../generated/prisma/client";
import config from "../config";
import { AppError } from "../utils/appError";

export const globalErrorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  // Always log full error in Render console for debugging
  console.error("Error from Global Error Handler:", err);

  let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
  let errorMessage: string = err.message || "Internal Server Error";
  let errorName: string = err.name || "Internal Server Error";
  let errorSources: Array<{ path: string | number; message: string }> = [];

  // 1. Zod Validation Errors (400)
  if (err instanceof ZodError) {
    statusCode = httpStatus.BAD_REQUEST;
    errorName = "ValidationError";
    errorMessage = "Validation error occurred";
    errorSources = err.issues.map((issue) => ({
      path: issue.path[issue.path.length - 1]?.toString() ?? "field",
      message: issue.message,
    }));
  }
  // 2. AppError (Checks instanceof AND property fallback in case of bundling issues)
  else if (err instanceof AppError || typeof err?.statusCode === "number") {
    statusCode = err.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
    errorName = err.name || "AppError";
    errorMessage = err.message;
  }
  // 3. Prisma Validation Errors
  else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = httpStatus.BAD_REQUEST;
    errorName = "PrismaValidationError";
    errorMessage = "You have provided incorrect field type or missing fields";
  }
  // 4. Prisma Known Request Errors
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    statusCode = httpStatus.BAD_REQUEST;
    errorName = "PrismaClientKnownRequestError";

    if (err.code === "P2002") {
      const field = Array.isArray(err.meta?.target)
        ? err.meta.target.join(", ")
        : "field";
      errorMessage = `Duplicate Key Error: Unique constraint violated on ${field}`;
    } else if (err.code === "P2003") {
      errorMessage = "Foreign key constraint failed";
    } else if (err.code === "P2025") {
      statusCode = httpStatus.NOT_FOUND;
      errorMessage =
        "An operation failed because it depends on one or more records that were required but not found.";
    }
  }
  // 5. Prisma Initialization / DB Connection Errors
  else if (err instanceof Prisma.PrismaClientInitializationError) {
    statusCode = httpStatus.BAD_REQUEST;
    errorName = "PrismaClientInitializationError";

    if (err.errorCode === "P1000") {
      statusCode = httpStatus.UNAUTHORIZED;
      errorMessage =
        "Authentication failed against database server. Please Check Your Credentials";
    } else if (err.errorCode === "P1001") {
      errorMessage = "Can't reach database server";
    }
  }
  // 6. Prisma Unknown Request Error
  else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    errorName = "PrismaClientUnknownRequestError";
    errorMessage = "Error occurred during query execution";
  }
  // 7. Standard JavaScript Errors
  else if (err instanceof Error) {
    errorMessage = err.message;
    errorName = err.name;
  }

  // Only mask unexpected 500+ crashes; 4xx client errors remain transparent in production
  const isProduction = config.node_env === "production";
  const isInternalServerError = statusCode >= 500;

  res.status(statusCode).json({
    success: false,
    statusCode,
    name:
      isProduction && isInternalServerError
        ? "Internal Server Error"
        : errorName,
    message:
      isProduction && isInternalServerError
        ? "Something went wrong on the server"
        : errorMessage,
    ...(errorSources.length > 0 && { errorSources }),
    error: isProduction ? undefined : err,
    stack: isProduction ? undefined : err.stack,
  });
};
