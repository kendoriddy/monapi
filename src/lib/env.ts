/**
 * Shared Supabase env resolution for Live mode.
 * Accepts both legacy anon keys and the newer publishable key name.
 * Trims values — Vercel env pastes often include trailing whitespace/newlines.
 *
 * IMPORTANT: NEXT_PUBLIC_* vars are inlined at build time. After adding them
 * in Vercel, you must redeploy for Live to unlock.
 */

function trimEnv(value: string | undefined): string {
  return (value ?? "").trim();
}

export function getSupabaseUrl() {
  return trimEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function getSupabaseAnonKey() {
  return (
    trimEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    trimEnv(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  );
}

export function getSupabaseServiceRoleKey() {
  return trimEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function isDemoModeForced() {
  const raw = trimEnv(process.env.MONAPI_DEMO_MODE).toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

function looksLikePlaceholder(url: string, key: string) {
  if (!url || !key) return true;
  if (url.includes("YOUR_PROJECT")) return true;
  if (key === "your_anon_key") return true;
  if (key.startsWith("your_")) return true;
  return false;
}

export type LiveBlockReason =
  | null
  | "demo_forced"
  | "missing_url"
  | "missing_key"
  | "placeholder_credentials";

export function evaluateSupabaseConfig() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  const demoForced = isDemoModeForced();
  const placeholder = looksLikePlaceholder(url, key);
  const configured = Boolean(url && key && !placeholder);

  let blockReason: LiveBlockReason = null;
  if (demoForced) blockReason = "demo_forced";
  else if (!url) blockReason = "missing_url";
  else if (!key) blockReason = "missing_key";
  else if (placeholder) blockReason = "placeholder_credentials";

  return {
    urlPresent: Boolean(url),
    keyPresent: Boolean(key),
    serviceRolePresent: Boolean(getSupabaseServiceRoleKey()),
    demoForced,
    configured,
    liveAvailable: configured && !demoForced,
    blockReason,
  };
}

export function isSupabaseReady() {
  return evaluateSupabaseConfig().configured;
}

export function isLiveModeAvailable() {
  return evaluateSupabaseConfig().liveAvailable;
}

export function liveBlockMessage(reason: LiveBlockReason): string {
  switch (reason) {
    case "demo_forced":
      return "Live is disabled because MONAPI_DEMO_MODE is set. Remove it in Vercel and redeploy.";
    case "missing_url":
      return "Live needs NEXT_PUBLIC_SUPABASE_URL. Add it in Vercel → Environment Variables, then redeploy.";
    case "missing_key":
      return "Live needs NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY). Add it in Vercel and redeploy.";
    case "placeholder_credentials":
      return "Supabase env vars still look like placeholders. Use real project values and redeploy.";
    default:
      return "Switch between demo data and live Supabase";
  }
}
