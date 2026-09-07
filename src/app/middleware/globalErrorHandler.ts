import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { Prisma } from "../../generated/prisma/client";
import config from "../config";
import { AppError } from "../utils/appError";

export const globalErrorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  console.error("Error from Global Error Handler:", err);

  let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
  let errorMessage: string = err.message || "Internal Server Error";
  let errorName: string = err.name || "Internal Server Error";

  if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = httpStatus.BAD_REQUEST;
    errorName = "ValidationError";
    errorMessage = "You have provided incorrect field type or missing fields";
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    statusCode = httpStatus.BAD_REQUEST;
    errorName = "PrismaClientKnownRequestError";

    if (err.code === "P2002") {
      errorMessage =
        "Duplicate Key Error: A unique constraint violation occurred";
    } else if (err.code === "P2003") {
      errorMessage = "Foreign key constraint failed";
    } else if (err.code === "P2025") {
      errorMessage =
        "An operation failed because it depends on one or more records that were required but not found.";
    }
  } else if (err instanceof Prisma.PrismaClientInitializationError) {
    statusCode = httpStatus.BAD_REQUEST;
    errorName = "PrismaClientInitializationError";

    if (err.errorCode === "P1000") {
      statusCode = httpStatus.UNAUTHORIZED;
      errorMessage =
        "Authentication failed against database server. Please Check Your Credentials";
    } else if (err.errorCode === "P1001") {
      errorMessage = "Can't reach database server";
    }
  } else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    errorName = "PrismaClientUnknownRequestError";
    errorMessage = "Error occurred during query execution";
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorName = err.name || "AppError";
    errorMessage = err.message;
  } else if (err instanceof Error) {
    errorMessage = err.message;
    errorName = err.name;
  }

  // Only mask unexpected 500-level system crashes in production
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
        ? "Internal Server Error"
        : errorMessage,
    error: isProduction ? undefined : err,
    stack: isProduction ? undefined : err.stack,
  });
};
