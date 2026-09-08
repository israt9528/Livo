import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import config from "../config";

interface ExtendedSMTPOptions extends SMTPTransport.Options {
  family?: number; // Exposes Node's net.SocketConnectOpts IPv4/IPv6 flag to TS
}

const smtpOptions: ExtendedSMTPOptions = {
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: config.smtp_user,
    pass: config.smtp_pass,
  },
  family: 4, // ⚠️ Enforces IPv4 socket connection on Render
  connectionTimeout: 10000,
  greetingTimeout: 5000,
  socketTimeout: 10000,
};

export const transporter = nodemailer.createTransport(smtpOptions);
