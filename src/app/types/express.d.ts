import { UserRole } from "../../generated/prisma/client";

export interface RequestUser {
	userId: string;
	email: string;
	name: string;
	role: UserRole;
}

declare global {
	namespace Express {
		interface Request {
			user?: RequestUser;
		}
	}
}
