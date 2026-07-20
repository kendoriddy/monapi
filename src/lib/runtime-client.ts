import type { RuntimeMode } from "@/lib/runtime";
import { RUNTIME_HEADER } from "@/lib/runtime";

export { RUNTIME_HEADER };
export type { Experience, RuntimeMode } from "@/lib/runtime";

/** Headers for client fetches so API routes honor the Demo/Live UI toggle. */
export function runtimeFetchHeaders(
  demoMode: boolean,
  init?: HeadersInit,
): HeadersInit {
  const runtime: RuntimeMode = demoMode ? "demo" : "live";
  return {
    ...Object.fromEntries(new Headers(init).entries()),
    [RUNTIME_HEADER]: runtime,
  };
}
