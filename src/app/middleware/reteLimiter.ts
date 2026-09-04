import rateLimit from "express-rate-limit";

// Standard Global Limiter: 100 requests per 15 minutes per IP
export const globalRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 100,
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		success: false,
		message:
			"Too many requests from this IP address. Please try again after 15 minutes.",
		errors: [{ message: "Rate limit exceeded" }],
	},
});

// Strict Auth Limiter: 10 requests per 15 minutes per IP for login/register
export const authRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 10,
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		success: false,
		message:
			"Too many authentication attempts. Please try again after 15 minutes.",
		errors: [{ message: "Auth rate limit exceeded" }],
	},
});
