import dotenv from "dotenv";
import path from "path";
import { cloudinary } from "../lib/cloudinary";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
  node_env: process.env.NODE_ENV,
  port: process.env.PORT,
  database_url: process.env.DATABASE_URL,
  bak_url: process.env.APP_URL,
  client_url: process.env.FRONTEND_URL,
  bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS!,
  jwt_access_secret: process.env.JWT_ACCESS_SECRET!,
  jwt_refresh_secret: process.env.JWT_REFRESH_SECRET!,
  jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN!,
  jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN!,
  admin_name: process.env.ADMIN_NAME!,
  admin_email: process.env.ADMIN_EMAIL!,
  admin_password: process.env.ADMIN_PASSWORD!,
  cloudinary_cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  cloudinary_api_key: process.env.CLOUDINARY_API_KEY!,
  cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET!,
  redis_username: process.env.REDIS_USERNAME!,
  redis_host: process.env.REDIS_HOST!,
  redis_port: process.env.REDIS_PORT!,
  redis_password: process.env.REDIS_PASSWORD!,
  smtp_host: process.env.SMTP_HOST!,
  smtp_port: process.env.SMTP_PORT!,
  smtp_user: process.env.SMTP_USER!,
  smtp_pass: process.env.SMTP_PASS!,
  email_form: process.env.EMAIL_FROM!,
};
