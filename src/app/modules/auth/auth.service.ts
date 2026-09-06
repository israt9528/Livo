import crypto from "crypto";
import httpStatus from "http-status";
import { hashPassword, comparePassword } from "../../utils/password.js";
import { generateTokenPair, verifyRefreshToken } from "../../utils/jwt.js";
import { AppError } from "../../utils/AppError.js";
import { sendEmail } from "../../utils/sendEmail.js";
import { redisClient } from "../../lib/redis.js";
import type {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from "./auth.validation.js";
import { prisma } from "../../lib/prisma.js";
import { UserStatus } from "../../../generated/prisma/client.js";

const OTP_EXPIRY_SECONDS = 300; // 5 minutes

const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

/**
 * Register a new TENANT or OWNER account
 */
const register = async (payload: RegisterInput, ipAddress?: string) => {
  const existingUser = await prisma.user.findUnique({
    where: { email: payload.email.toLowerCase() },
  });

  if (existingUser) {
    throw new AppError(
      httpStatus.CONFLICT,
      "An account with this email already exists.",
    );
  }

  const hashedPassword = await hashPassword(payload.password);

  const result = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        name: payload.name,
        email: payload.email.toLowerCase(),
        passwordHash: hashedPassword,
        phoneNumber: payload.phoneNumber ?? null,
        role: payload.role,
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phoneNumber: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    const tokens = generateTokenPair({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
    });

    await tx.user.update({
      where: { id: newUser.id },
      data: { refreshTokenHash: hashToken(tokens.refreshToken) },
    });

    await tx.auditLog.create({
      data: {
        userId: newUser.id,
        action: "USER_REGISTERED",
        resource: "users",
        resourceId: newUser.id,
        newValue: {
          email: newUser.email,
          role: newUser.role,
        },
        ipAddress: ipAddress ?? null,
      },
    });

    return { user: newUser, ...tokens };
  });

  return result;
};

/**
 * Authenticate credentials and issue refreshed session tokens
 */
const login = async (payload: LoginInput, ipAddress?: string) => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email.toLowerCase() },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      role: true,
      status: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt !== null) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password.");
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `Your account has been ${user.status.toLowerCase()}. Please contact support.`,
    );
  }

  const isPasswordValid = await comparePassword(
    payload.password,
    user.passwordHash,
  );
  if (!isPasswordValid) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password.");
  }

  const tokens = generateTokenPair({
    userId: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
  });

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: hashToken(tokens.refreshToken) },
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "USER_LOGGED_IN",
        resource: "users",
        resourceId: user.id,
        ipAddress: ipAddress ?? null,
      },
    }),
  ]);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
    },
    ...tokens,
  };
};

/**
 * Rotate Refresh and Access Tokens
 */
const refreshToken = async (incomingRefreshToken: string) => {
  const decoded = verifyRefreshToken(incomingRefreshToken);

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      refreshTokenHash: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt !== null) {
    throw new AppError(httpStatus.UNAUTHORIZED, "User no longer exists.");
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `Account is ${user.status.toLowerCase()}.`,
    );
  }

  const incomingTokenHash = hashToken(incomingRefreshToken);
  if (!user.refreshTokenHash || user.refreshTokenHash !== incomingTokenHash) {
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: null },
    });
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Invalid or expired refresh token. Please log in again.",
    );
  }

  const newTokens = generateTokenPair({
    userId: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash: hashToken(newTokens.refreshToken) },
  });

  return newTokens;
};

/**
 * Revoke active session by clearing refresh token hash
 */
const logout = async (userId: string) => {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshTokenHash: null },
  });

  return true;
};

/**
 * Generate a 6-digit numeric OTP, cache in Redis with TTL, and dispatch via EJS email
 */
const forgotPassword = async (
  payload: ForgotPasswordInput,
  ipAddress?: string,
) => {
  const email = payload.email.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt !== null) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "No account found with this email address.",
    );
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `Account is ${user.status.toLowerCase()}. Password reset is not permitted.`,
    );
  }

  // Generate secure 6-digit numeric OTP
  const otp = crypto.randomInt(100000, 999999).toString();
  const redisKey = `otp:forgot-password:${email}`;

  // Store in Redis using the official redis client syntax ({ EX: seconds })
  await redisClient.set(redisKey, otp, {
    EX: OTP_EXPIRY_SECONDS,
  });

  // Send styled HTML email template via Nodemailer
  await sendEmail({
    to: user.email,
    subject: "Password Reset Verification Code",
    templateName: "forgotPassword",
    templateData: {
      name: user.name,
      otp,
      validityMinutes: OTP_EXPIRY_SECONDS / 60,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "PASSWORD_RESET_OTP_REQUESTED",
      resource: "users",
      resourceId: user.id,
      ipAddress: ipAddress ?? null,
    },
  });

  return {
    message: "A 6-digit verification code has been sent to your email address.",
  };
};

/**
 * Validate OTP from Redis, update password hash, and revoke existing sessions
 */
const resetPassword = async (
  payload: ResetPasswordInput,
  ipAddress?: string,
) => {
  const email = payload.email.toLowerCase();
  const redisKey = `otp:forgot-password:${email}`;

  // 1. Validate OTP from Redis
  const cachedOtp = await redisClient.get(redisKey);
  if (!cachedOtp) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "The verification code has expired or was never requested.",
    );
  }
  if (cachedOtp !== payload.otp) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invalid verification code. Please check and try again.",
    );
  }

  // 2. Fetch user (including name for the email template)
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt !== null) {
    throw new AppError(httpStatus.NOT_FOUND, "User account no longer exists.");
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `Account is ${user.status.toLowerCase()}.`,
    );
  }

  // 3. Hash replacement password
  const newPasswordHash = await hashPassword(payload.newPassword);

  // 4. Update password and invalidate refresh token sessions
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        refreshTokenHash: null,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "PASSWORD_RESET_SUCCESSFUL",
        resource: "users",
        resourceId: user.id,
        ipAddress: ipAddress ?? null,
      },
    });
  });

  // 5. Invalidate OTP from Redis
  await redisClient.del(redisKey);

  // 6. Send confirmation email using resetPassword.ejs
  await sendEmail({
    to: user.email,
    subject: "Security Alert: Password Changed Successfully",
    templateName: "resetPassword",
    templateData: {
      name: user.name,
      resetTime: new Date().toUTCString(),
      ipAddress: ipAddress || "Unknown",
    },
  });

  return {
    message:
      "Password reset successful. You can now log in with your new password.",
  };
};

export const AuthService = {
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
};
