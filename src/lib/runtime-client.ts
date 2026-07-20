import { RUNTIME_HEADER } from "@/lib/preferences";

/** Headers for client fetches so API routes honor the Demo/Live UI toggle. */
export function runtimeFetchHeaders(
  demoMode: boolean,
  init?: HeadersInit,
): HeadersInit {
  return {
    ...Object.fromEntries(new Headers(init).entries()),
    [RUNTIME_HEADER]: demoMode ? "demo" : "live",
  };
}
