import { NextResponse } from "next/server";
import { evaluateSupabaseConfig, liveBlockMessage } from "@/lib/env";

/**
 * Safe diagnostics for why Live is locked on a deployment.
 * Does not expose secret values.
 */
export async function GET() {
  const config = evaluateSupabaseConfig();
  return NextResponse.json({
    liveAvailable: config.liveAvailable,
    blockReason: config.blockReason,
    message: liveBlockMessage(config.blockReason),
    checks: {
      NEXT_PUBLIC_SUPABASE_URL: config.urlPresent,
      NEXT_PUBLIC_SUPABASE_ANON_KEY_or_PUBLISHABLE_KEY: config.keyPresent,
      SUPABASE_SERVICE_ROLE_KEY: config.serviceRolePresent,
      MONAPI_DEMO_MODE: config.demoForced,
    },
    hint: config.liveAvailable
      ? null
      : "NEXT_PUBLIC_* vars are baked in at build time. After changing them in Vercel, trigger a Redeploy.",
  });
}
