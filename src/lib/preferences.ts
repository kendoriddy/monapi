import { cookies } from "next/headers";
import {
  evaluateSupabaseConfig,
  isDemoModeForced,
  isLiveModeAvailable as envLiveAvailable,
  isSupabaseReady,
  liveBlockMessage,
  type LiveBlockReason,
} from "@/lib/env";

export const EXPERIENCE_COOKIE = "monapi_experience";
export const RUNTIME_COOKIE = "monapi_runtime";

export type Experience = "publisher" | "subscriber";
export type RuntimeMode = "demo" | "live";

export function parseExperience(value: string | undefined | null): Experience {
  return value === "subscriber" ? "subscriber" : "publisher";
}

export function parseRuntime(value: string | undefined | null): RuntimeMode {
  return value === "live" ? "live" : "demo";
}

export async function getExperience(): Promise<Experience> {
  const jar = await cookies();
  return parseExperience(jar.get(EXPERIENCE_COOKIE)?.value);
}

export async function getRuntimePreference(): Promise<RuntimeMode | undefined> {
  const jar = await cookies();
  const value = jar.get(RUNTIME_COOKIE)?.value;
  if (value === "live" || value === "demo") return value;
  return undefined;
}

/** Live requires real Supabase credentials and no forced demo env. */
export function isLiveModeAvailable() {
  return envLiveAvailable();
}

export function getLiveBlockReason(): LiveBlockReason {
  return evaluateSupabaseConfig().blockReason;
}

export function getLiveBlockMessage() {
  return liveBlockMessage(getLiveBlockReason());
}

export function resolveDemoModeFromPreference(
  preference: RuntimeMode | undefined,
): boolean {
  if (isDemoModeForced()) return true;
  if (!isSupabaseReady()) return true;
  if (preference === "demo") return true;
  if (preference === "live") return false;
  // Default: Live when Supabase is configured (esp. on Vercel production).
  return false;
}
