import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z
    .string()
    .url({
      message: "DATABASE_URL must be a valid PostgreSQL connection string",
    }),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, {
      message: "JWT_ACCESS_SECRET must be at least 32 characters long",
    }),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, {
      message: "JWT_REFRESH_SECRET must be at least 32 characters long",
    }),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  CLIENT_URL: z.string().url().default("http://localhost:3000"),
  PAYMENT_GATEWAY: z.enum(["STRIPE", "BKASH", "SSLCOMMERZ"]).default("STRIPE"),
  STRIPE_SECRET_KEY: z.string().default("sk_test_placeholder"),
  STRIPE_WEBHOOK_SECRET: z.string().default("whsec_placeholder"),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ CRITICAL: Invalid environment variables detected:");
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }

  return result.data;
};

export const env = parseEnv();
export type EnvConfig = z.infer<typeof envSchema>;
