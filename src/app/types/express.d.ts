import { UserRole } from "../../generated/prisma/client";

import "express";

export interface RequestUser {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: RequestUser;
  }
}
declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}

export {};
