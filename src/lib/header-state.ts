import {
  getExperience,
  getRuntimePreference,
  isLiveModeAvailable,
  resolveDemoModeFromPreference,
  type Experience,
  type RuntimeMode,
} from "@/lib/preferences";

export async function getHeaderState(): Promise<{
  experience: Experience;
  runtime: RuntimeMode;
  liveAvailable: boolean;
  demo: boolean;
}> {
  const experience = await getExperience();
  const preference = await getRuntimePreference();
  const liveAvailable = isLiveModeAvailable();
  const demo = resolveDemoModeFromPreference(preference);
  const runtime: RuntimeMode = demo ? "demo" : "live";

  return { experience, runtime, liveAvailable, demo };
}
