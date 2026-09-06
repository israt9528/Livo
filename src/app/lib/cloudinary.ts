import { v2 as cloudinary } from "cloudinary";
import config from "../config";

import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: config.cloudinary_cloud_name?.trim(),
  api_key: config.cloudinary_api_key?.trim(),
  api_secret: config.cloudinary_api_secret?.trim(),
  secure: true,
});

export { cloudinary };
