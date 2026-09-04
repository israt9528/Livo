import bcrypt from "bcryptjs";
import httpStatus from "http-status";
import config from "../config";
import { prisma } from "../lib/prisma";
import { AppError } from "./appError";
import { UserRole, UserStatus } from "../../generated/prisma/enums";

export const seedAdmin = async () => {
  try {
    const isAdminExist = await prisma.user.findFirst({
      where: {
        role: UserRole.ADMIN,
      },
    });

    if (isAdminExist) {
      console.log(" Admin Already Exists!");
      return;
    }

    const name = config.admin_name;
    const email = config.admin_email;
    const password = config.admin_password;

    if (!name || !email || !password) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Super Admin Name , Email, Password Missing In Env File!!!",
      );
    }

    const hashedPassword = await bcrypt.hash(
      password,
      Number(config.bcrypt_salt_rounds),
    );

    const Admin = await prisma.user.create({
      data: {
        email: "admin@housingplatform.com",
        passwordHash: hashedPassword,
        name: "Master System Administrator",
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        phoneNumber: "+10000000000",
      },
    });

    console.log("Admin Created : ", Admin);
  } catch (error) {
    console.log("Error Seeding Admin : ", error);

    await prisma.user.delete({
      where: {
        email: config.admin_email,
      },
    });
  }
};
