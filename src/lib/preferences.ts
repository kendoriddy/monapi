import { cookies } from "next/headers";

export const EXPERIENCE_COOKIE = "monapi_experience";
export const RUNTIME_COOKIE = "monapi_runtime";

export type Experience = "publisher" | "subscriber";
export type RuntimeMode = "demo" | "live";

function isSupabaseReady() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !key) return false;
  if (
    url.includes("YOUR_PROJECT") ||
    key.startsWith("your_") ||
    key === "your_anon_key"
  ) {
    return false;
  }
  return true;
}

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
  return process.env.MONAPI_DEMO_MODE !== "true" && isSupabaseReady();
}

export function resolveDemoModeFromPreference(
  preference: RuntimeMode | undefined,
): boolean {
  if (process.env.MONAPI_DEMO_MODE === "true") return true;
  if (!isSupabaseReady()) return true;
  if (preference === "demo") return true;
  if (preference === "live") return false;
  return false;
}
