import { NextResponse } from "next/server";
import {
  EXPERIENCE_COOKIE,
  RUNTIME_COOKIE,
  isLiveModeAvailable,
  parseExperience,
  parseRuntime,
  type Experience,
  type RuntimeMode,
} from "@/lib/preferences";

const COOKIE_OPTS = {
  path: "/",
  sameSite: "lax" as const,
  httpOnly: false,
  maxAge: 60 * 60 * 24 * 365,
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    experience?: string;
    runtime?: string;
  };

  const response = NextResponse.json({ ok: true });

  if (body.experience !== undefined) {
    const experience: Experience = parseExperience(body.experience);
    response.cookies.set(EXPERIENCE_COOKIE, experience, COOKIE_OPTS);
  }

  if (body.runtime !== undefined) {
    let runtime: RuntimeMode = parseRuntime(body.runtime);
    if (runtime === "live" && !isLiveModeAvailable()) {
      runtime = "demo";
    }
    response.cookies.set(RUNTIME_COOKIE, runtime, COOKIE_OPTS);
  }

  return response;
}
