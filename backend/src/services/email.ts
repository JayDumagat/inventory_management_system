import nodemailer from "nodemailer";
import { db } from "../db";
import { integrations } from "../db/schema";
import { and, eq } from "drizzle-orm";

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

export interface TenantEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendTenantEmail(tenantId: string, input: TenantEmailInput): Promise<{ sent: boolean; reason?: string }> {
  const [smtpIntegration] = await db
    .select()
    .from(integrations)
    .where(and(
      eq(integrations.tenantId, tenantId),
      eq(integrations.provider, "smtp"),
      eq(integrations.isEnabled, true),
    ))
    .limit(1);

  const cfg = (smtpIntegration?.config ?? {}) as SmtpConfig;
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
