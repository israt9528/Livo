import ejs from "ejs";
import path from "path";
import httpStatus from "http-status";
import { transporter } from "../lib/nodemailer.js";
import { AppError } from "./AppError.js";

interface SendEmailOptions {
  to: string;
  subject: string;
  templateName: string;
  templateData: Record<string, unknown>;
}

export const sendEmail = async ({
  to,
  subject,
  templateName,
  templateData,
}: SendEmailOptions): Promise<void> => {
  try {
    const templatePath = path.join(
      process.cwd(),
      "src",
      "app",
      "templates",
      `${templateName}.ejs`,
    );

    const html = await ejs.renderFile(templatePath, templateData);

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Email transmission failed:", error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to send verification email: ${message}`,
    );
  }
};
