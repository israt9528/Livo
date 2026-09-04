import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
const basePrisma = new PrismaClient({ adapter });

// Apply soft-delete filter extension to all read queries
export const prisma = basePrisma.$extends({
	query: {
		$allModels: {
			async findMany({ model, args, query }) {
				const softDeleteModels = [
					"User",
					"Property",
					"Unit",
					"Room",
					"Application",
					"Lease",
				];

				if (softDeleteModels.includes(model)) {
					args.where = {
						...args.where,
						deletedAt: null,
					};
				}
				return query(args);
			},

			async findFirst({ model, args, query }) {
				const softDeleteModels = [
					"User",
					"Property",
					"Unit",
					"Room",
					"Application",
					"Lease",
				];

				if (softDeleteModels.includes(model)) {
					args.where = {
						...args.where,
						deletedAt: null,
					};
				}
				return query(args);
			},
		},
	},
});

// Re-export all enums and types so they can be imported directly from this file
export * from "../../generated/prisma/client";
