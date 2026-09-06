import { createClient } from "redis";
import config from "../config/index.js"; // Adjust import to your config path

export const redisClient = createClient({
  username: config.redis_username || undefined,
  password: config.redis_password || undefined,
  socket: {
    host: config.redis_host || "127.0.0.1",
    port: Number(config.redis_port) || 6379,
  },
});

redisClient.on("connect", () => {
  console.log("🚀 [Redis] Client connected successfully");
});

redisClient.on("error", (error) => {
  console.error("❌ [Redis] Client error:", error);
});
