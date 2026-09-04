import express, { Application, Request, Response } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import config from "./app/config";
import { globalRateLimiter } from "./app/middleware/reteLimiter";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";

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

// Fallback 404 Route
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Cannot find route ${req.originalUrl} on this server`,
    errors: [],
  });
});

app.use(globalErrorHandler);

export default app;
