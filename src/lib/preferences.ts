import { cookies } from "next/headers";
import type { Experience, RuntimeMode } from "@/lib/runtime";
import { EXPERIENCE_COOKIE, RUNTIME_COOKIE } from "@/lib/preferences-constants";

export type { Experience, RuntimeMode } from "@/lib/runtime";
export { RUNTIME_HEADER } from "@/lib/runtime";
export { EXPERIENCE_COOKIE, RUNTIME_COOKIE } from "@/lib/preferences-constants";

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

/**
 * Demo only when the user picks Demo, or MONAPI_DEMO_MODE=true forces it.
 * Default (no cookie) is Live.
 */
export function resolveDemoModeFromPreference(
  preference: RuntimeMode | undefined,
): boolean {
  if (process.env.MONAPI_DEMO_MODE === "true") return true;
  if (preference === "demo") return true;
  return false;
}
