import { EXPERIENCE_COOKIE, RUNTIME_COOKIE } from "@/lib/preferences-constants";
import type { Experience, RuntimeMode } from "@/lib/runtime";

const ONE_YEAR = 60 * 60 * 24 * 365;

function setCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`;
}

/** Write Demo/Live + Publisher/Subscriber cookies in the browser — no API. */
export function setClientPreferences(input: {
  experience?: Experience;
  runtime?: RuntimeMode;
}) {
  if (input.experience) setCookie(EXPERIENCE_COOKIE, input.experience);
  if (input.runtime) setCookie(RUNTIME_COOKIE, input.runtime);
}
