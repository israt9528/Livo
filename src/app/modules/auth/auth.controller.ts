import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { AuthService } from "./auth.service.js";
import { env } from "../../config/env.js";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days matching refresh token
};

const register = catchAsync(async (req: Request, res: Response) => {
  const ipAddress = req.ip || req.socket.remoteAddress;
  const result = await AuthService.register(req.body, ipAddress);

  // Set refresh token cookie for client convenience
  res.cookie("refreshToken", result.refreshToken, COOKIE_OPTIONS);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "User registered successfully",
    data: result,
  });
});

const login = catchAsync(async (req: Request, res: Response) => {
  const ipAddress = req.ip || req.socket.remoteAddress;
  const result = await AuthService.login(req.body, ipAddress);

  res.cookie("refreshToken", result.refreshToken, COOKIE_OPTIONS);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User logged in successfully",
    data: result,
  });
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
  // Read from body or cookie
  const token = req.body.refreshToken || req.cookies?.refreshToken;

  if (!token) {
    sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: "Refresh token is required in request body or cookie",
      data: null,
    });
    return;
  }

  const tokens = await AuthService.refreshToken(token);

  res.cookie("refreshToken", tokens.refreshToken, COOKIE_OPTIONS);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Tokens rotated successfully",
    data: tokens,
  });
});

const logout = catchAsync(async (req: Request, res: Response) => {
  // req.user is guaranteed by auth() middleware
  if (req.user?.userId) {
    await AuthService.logout(req.user.userId);
  }

  res.clearCookie("refreshToken", COOKIE_OPTIONS);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User logged out successfully",
    data: null,
  });
});

export const AuthController = {
  register,
  login,
  refreshToken,
  logout,
};
