import rateLimit from "express-rate-limit";
import type { Request } from "express";

// Helper to safely extract client IP behind Vercel / reverse proxies
const getClientIp = (req: Request): string => {
	const forwarded = req.headers["x-forwarded-for"];
	if (typeof forwarded === "string") {
		return forwarded.split(",")[0].trim();
	}
	return req.ip || "127.0.0.1";
};

// Standard Global Limiter: 100 requests per 15 minutes per IP
export const globalRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 100,
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: getClientIp,
	validate: {
		forwardedHeader: false,
	},
	message: {
		success: false,
		message:
			"Too many requests from this IP address. Please try again after 15 minutes.",
		errors: [{ message: "Rate limit exceeded" }],
	},
});

// Strict Auth Limiter: 10 requests per 15 minutes per IP for login/register/forgot-password
export const authRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 10,
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: getClientIp,
	validate: {
		forwardedHeader: false,
	},
	message: {
		success: false,
		message:
			"Too many authentication attempts. Please try again after 15 minutes.",
		errors: [{ message: "Auth rate limit exceeded" }],
	},
});
