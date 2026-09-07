import nodemailer from "nodemailer";
// import dotenv from "dotenv";
import config from "../config";

// dotenv.config();

// const smtpPort = Number(config.smtp_port) || 587;

export const transporter = nodemailer.createTransport({
  host: config.smtp_host || "smtp.gmail.com",
  port: Number(config.smtp_port) || 465,
  secure: false, // true for 465, false for 587
  auth: {
    user: config.smtp_user,
    pass: config.smtp_pass,
  },
  tls: {
    rejectUnauthorized: false, // Prevents TLS handshake timeouts
  },
  connectionTimeout: 10000, // 10 seconds timeout
  greetingTimeout: 5000,
  socketTimeout: 10000,
  //   family: 4, // Explicitly enforce IPv4 socket connection
});
