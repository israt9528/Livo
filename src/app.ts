import express, {
	type Application,
	type NextFunction,
	type Request,
	type Response,
} from "express";
import cookieParser from "cookie-parser";
import httpStatus from "http-status";
import cors from "cors";
import config from "./app/config";
import { globalRateLimiter } from "./app/middleware/reteLimiter";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { authRoutes } from "./app/modules/auth/auth.route";
import { AppError } from "./app/utils/AppError";
import { userRoutes } from "./app/modules/user/user.route";
import { roommateRoutes } from "./app/modules/roommate/roommate.route";
import { propertyRoutes } from "./app/modules/property/property.route";
import { unitRoutes } from "./app/modules/unit/unit.route";
import { roomRoutes } from "./app/modules/room/room.route";
import { mediaRoutes } from "./app/modules/media/media.route";
import { viewingRoutes } from "./app/modules/viewing/viewing.route";
import { applicationRoutes } from "./app/modules/application/application.route";
import { leaseRoutes } from "./app/modules/lease/lease.route";
import { utilityRoutes } from "./app/modules/utility/utility.route";

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
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/roommate", roommateRoutes);
app.use("/api/v1/properties", propertyRoutes);
app.use("/api/v1/units", unitRoutes);
app.use("/api/v1/rooms", roomRoutes);
app.use("/api/v1/media", mediaRoutes);
app.use("/api/v1/viewing-requests", viewingRoutes);
app.use("/api/v1/applications", applicationRoutes);
app.use("/api/v1/leases", leaseRoutes);
app.use("/api/v1/utilities", utilityRoutes);

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
