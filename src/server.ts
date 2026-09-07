import dns from "node:dns";
// Force Node to resolve IPv4 addresses first (fixes Render ENETUNREACH on port 587)
dns.setDefaultResultOrder("ipv4first");

import app from "./app";
import config from "./app/config";
import { transporter } from "./app/lib/nodemailer";
import { prisma } from "./app/lib/prisma";
import { redisClient } from "./app/lib/redis";
import { seedAdmin } from "./app/utils/seed";

const PORT = Number(config.port);

const main = async () => {
  try {
    await prisma.$connect();
    console.log("Connected to the database successfully.");

    await redisClient.connect();

    try {
      if (transporter) {
        await transporter.verify();
        console.log("📧 [Nodemailer] SMTP Server is ready");
      }
    } catch (mailError) {
      console.warn(
        "⚠️ [Nodemailer] SMTP failed to connect, continuing anyway:",
        mailError,
      );
    }
    await seedAdmin();

    app.listen(PORT, "0.0.0.0", () => {
      //   console.log(`Server is running on port ${PORT}`);
      console.log(
        `🚀 [HTTP] Server running in [${config.node_env}] mode on port: ${config.port}`,
      );
      console.log(
        `🔗 Health Check ready at: http://localhost:${config.port}/api/v1/health`,
      );
    });
  } catch (error) {
    console.error("Error starting the server:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

main();
