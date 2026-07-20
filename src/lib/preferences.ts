import { cookies } from "next/headers";

export const EXPERIENCE_COOKIE = "monapi_experience";
export const RUNTIME_COOKIE = "monapi_runtime";
/** Client → API header so Demo never accidentally hits Live backends. */
export const RUNTIME_HEADER = "x-monapi-runtime";

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
