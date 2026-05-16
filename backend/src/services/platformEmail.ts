import nodemailer from "nodemailer";
import { db } from "../db";
import { platformSettings } from "../db/schema";
import { eq } from "drizzle-orm";

interface SmtpConfig {
  host?: string;
  endpoint?: string;
  port?: number | string;
  secure?: boolean;
  username?: string;
  apiKey?: string;
  password?: string;
  storeName?: string;
  fromEmail?: string;
  fromName?: string;
}

export interface PlatformEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendPlatformEmail(input: PlatformEmailInput): Promise<{ sent: boolean; reason?: string }> {
  const [smtpSetting] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.provider, "smtp"))
    .limit(1);

  const cfg = (smtpSetting?.config ?? {}) as SmtpConfig;
  const host = cfg.host ?? cfg.endpoint ?? process.env.SMTP_HOST;
  const port = Number(cfg.port ?? process.env.SMTP_PORT ?? 587);
  const user = cfg.username ?? cfg.apiKey ?? process.env.SMTP_USER;
  const pass = cfg.password ?? cfg.storeName ?? process.env.SMTP_PASS;
  const secure = cfg.secure ?? (
    process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === "true"
      : port === 465
  );

  if (!host || !port) return { sent: false, reason: "SMTP host/port is missing" };

  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });

  await transport.verify();

  const fromEmail = cfg.fromEmail ?? process.env.SMTP_FROM_EMAIL ?? user;
  const fromName = cfg.fromName ?? process.env.SMTP_FROM_NAME ?? "Inventory Management System";
  if (!fromEmail) return { sent: false, reason: "SMTP sender email is missing" };

  await transport.sendMail({
    from: `${fromName} <${fromEmail}>`,
    to: input.to,
    subject: input.subject,
    text: input.text,
    ...(input.html ? { html: input.html } : {}),
  });

  return { sent: true };
}
