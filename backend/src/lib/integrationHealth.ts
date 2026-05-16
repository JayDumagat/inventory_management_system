import nodemailer from "nodemailer";

interface TwilioConfig {
  accountSid?: string;
  apiKey?: string;
  authToken?: string;
  password?: string;
}

interface StripeConfig {
  secretKey?: string;
  apiKey?: string;
}

interface SmtpConfig {
  host?: string;
  endpoint?: string;
  port?: number | string;
  secure?: boolean;
  username?: string;
  apiKey?: string;
  password?: string;
  storeName?: string;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function testStripe(config: StripeConfig) {
  const secretKey = config.secretKey ?? config.apiKey;
  if (!secretKey) return { ok: false, message: "Stripe secret key is missing" };

  const response = await fetchWithTimeout("https://api.stripe.com/v1/account", {
    method: "GET",
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!response.ok) {
    const errorText = await response.text();
    return { ok: false, message: `Stripe authentication failed (${response.status})`, details: errorText };
  }
  return { ok: true, message: "Stripe connection successful" };
}

async function testTwilio(config: TwilioConfig) {
  const accountSid = config.accountSid;
  const authToken = config.authToken ?? config.password ?? config.apiKey;
  if (!accountSid || !authToken) return { ok: false, message: "Twilio account SID/auth token is missing" };

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const response = await fetchWithTimeout(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
    method: "GET",
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!response.ok) {
    const errorText = await response.text();
    return { ok: false, message: `Twilio authentication failed (${response.status})`, details: errorText };
  }
  return { ok: true, message: "Twilio connection successful" };
}

async function testSmtp(config: SmtpConfig) {
  const host = config.host ?? config.endpoint;
  const port = Number(config.port ?? 587);
  const user = config.username ?? config.apiKey;
  const pass = config.password ?? config.storeName;
  const secure = Boolean(config.secure ?? port === 465);

  if (!host || !port) return { ok: false, message: "SMTP host/port is missing" };

  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });

  await transport.verify();
  return { ok: true, message: "SMTP connection successful" };
}

export async function testIntegrationConnection(provider: string, config: Record<string, unknown>) {
  try {
    if (provider === "stripe") return await testStripe(config as StripeConfig);
    if (provider === "twilio") return await testTwilio(config as TwilioConfig);
    if (provider === "smtp") return await testSmtp(config as SmtpConfig);

    return {
      ok: Object.keys(config ?? {}).length > 0,
      message: "Connection test is only available for SMTP, Twilio, and Stripe",
    };
  } catch (error) {
    return {
      ok: false,
      message: "Connection test failed",
      details: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
