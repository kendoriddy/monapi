import {
  getExperience,
  getRuntimePreference,
  resolveDemoModeFromPreference,
  type Experience,
  type RuntimeMode,
} from "@/lib/preferences";

export async function getHeaderState(): Promise<{
  experience: Experience;
  runtime: RuntimeMode;
  demo: boolean;
}> {
  const experience = await getExperience();
  const preference = await getRuntimePreference();
  const demo = resolveDemoModeFromPreference(preference);
  const runtime: RuntimeMode = demo ? "demo" : "live";

  return { experience, runtime, demo };
}
