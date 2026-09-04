import express, { Application, NextFunction, Request, Response } from "express";
import cookieParser from "cookie-parser";
import httpStatus from "http-status";
import cors from "cors";
import config from "./app/config";
import { globalRateLimiter } from "./app/middleware/reteLimiter";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { authRoutes } from "./app/modules/auth/auth.route";
import { AppError } from "./app/utils/AppError";

const app: Application = express();

// Base Middleware
app.use(
  cors({
    origin: config.client_url,
    credentials: true,
  }),
);
app.use(globalRateLimiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Standardized Health Check Endpoint
app.get("/api/v1/health", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Housing & Roommate Management System API is healthy",
    data: {
      status: "UP",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? "development",
    },
  });
});

app.use("/api/v1/auth", authRoutes);

// Fallback 404 Route
app.use((req: Request, _res: Response, next: NextFunction) => {
  next(
    new AppError(
      httpStatus.NOT_FOUND,
      `Cannot find route ${req.originalUrl} on this server`,
    ),
  );
});

app.use(globalErrorHandler);

export default app;
