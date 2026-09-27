import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "stockly_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

type AuthMode = "open" | "locked" | "misconfigured";
export type Access = "open" | "authorized" | "unauthorized" | "misconfigured";

// Local development remains easy to explore. A Vercel deployment always fails closed.
export function authMode(): AuthMode {
  const password = process.env.STOCKLY_ADMIN_PASSWORD;
  const secret = process.env.STOCKLY_SESSION_SECRET;
  if (password && password.length >= 12 && secret && secret.length >= 32) return "locked";
  if (process.env.VERCEL === "1" || process.env.VERCEL_ENV || password || secret) return "misconfigured";
  return "open";
}

function equalConstantTime(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isValidPassword(value: string): boolean {
  const configured = process.env.STOCKLY_ADMIN_PASSWORD;
  if (authMode() !== "locked" || !configured || value.length > 256) return false;
  const digest = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
  return equalConstantTime(digest(value), digest(configured));
}

export function createSession(): string {
  const secret = process.env.STOCKLY_SESSION_SECRET;
  if (authMode() !== "locked" || !secret) throw new Error("Session configuration is missing");
  const expires = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const signature = createHmac("sha256", secret).update(String(expires)).digest("hex");
  return `${expires}.${signature}`;
}

function isValidSession(value: string | undefined): boolean {
  const secret = process.env.STOCKLY_SESSION_SECRET;
  if (!secret || !value || !/^\d{10,11}\.[a-f0-9]{64}$/.test(value)) return false;
  const [expires, signature] = value.split(".");
  if (Number(expires) <= Date.now() / 1000) return false;
  const expected = createHmac("sha256", secret).update(expires).digest("hex");
  return equalConstantTime(signature, expected);
}

export function accessForSession(value: string | undefined): Access {
  const mode = authMode();
  if (mode === "open") return "open";
  if (mode === "misconfigured") return "misconfigured";
  return isValidSession(value) ? "authorized" : "unauthorized";
}

export async function pageAccess(): Promise<Access> {
  const cookieStore = await cookies();
  return accessForSession(cookieStore.get(SESSION_COOKIE)?.value);
}

function requestSession(request: Request): string | undefined {
  const cookie = request.headers.get("cookie")?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return cookie?.slice(SESSION_COOKIE.length + 1);
}

export function apiAccess(request: Request): Response | null {
  const status = accessForSession(requestSession(request));
  if (status === "misconfigured") {
    return Response.json({ error: "Set STOCKLY_ADMIN_PASSWORD and STOCKLY_SESSION_SECRET to enable this deployment." },
      { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (status === "unauthorized") {
    return Response.json({ error: "Sign in to continue." },
      { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  return null;
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin) {
    try { return new URL(origin).origin === new URL(request.url).origin; }
    catch { return false; }
  }
  return request.headers.get("sec-fetch-site") !== "cross-site";
}
