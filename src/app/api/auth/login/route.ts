import { authMode, createSession, isSameOrigin, isValidPassword, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const mode = authMode();
  if (mode === "misconfigured") {
    return NextResponse.json({ error: "Set both Stockly security variables in Vercel and redeploy." }, { status: 503 });
  }
  if (mode === "open") return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });

  const parsed = z.object({ password: z.string().min(1).max(256) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isValidPassword(parsed.data.password)) {
    return NextResponse.json({ error: "Incorrect password. Please try again." },
      { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(SESSION_COOKIE, createSession(), {
    httpOnly: true,
    secure: process.env.VERCEL === "1",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
