import nodemailer from "nodemailer";
// import dotenv from "dotenv";
import config from "../config";

// dotenv.config();

const smtpPort = Number(config.smtp_port) || 587;

export const transporter = nodemailer.createTransport({
  host: config.smtp_host || "smtp.gmail.com",
  port: smtpPort,
  secure: smtpPort === 465, // true for 465, false for 587/STARTTLS
  auth: {
    user: config.smtp_user,
    pass: config.smtp_pass,
  },
});
