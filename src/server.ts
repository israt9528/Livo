import app from "./app";
import config from "./app/config";
import { transporter } from "./app/lib/nodemailer";
import { prisma } from "./app/lib/prisma";
import { redisClient } from "./app/lib/redis";
import { seedAdmin } from "./app/utils/seed";

const PORT = config.port;

const main = async () => {
  try {
    await prisma.$connect();
    console.log("Connected to the database successfully.");

    await redisClient.connect();

    await transporter.verify();
    console.log("Nodemailer Connected Successfully.");

    await seedAdmin();

    app.listen(PORT, () => {
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
