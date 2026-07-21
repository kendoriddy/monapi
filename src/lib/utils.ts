import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNgn(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function generateApiKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `sk_monapi_${hex}`;
}

export function generatePaymentReference() {
  return `MONAPI_${crypto.randomUUID().replace(/-/g, "")}`;
}

/**
 * Monnify often appends `?paymentReference=…` onto redirect URLs that already
 * contain `?ref=…`, producing a corrupted query like:
 *   ref=MONAPI_abc?paymentReference=MONAPI_abc
 */
export function normalizePaymentReference(
  raw: string | null | undefined,
): string {
  if (!raw) return "";
  let value = raw.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    /* keep raw */
  }
  // Drop anything after an embedded `?` or `&`
  value = value.split("?")[0].split("&")[0].trim();
  const match = value.match(/MONAPI_[A-Za-z0-9]+/);
  return match?.[0] ?? value;
}

/** Demo-friendly slug: African Location API → african-location-api */
export function slugifyProductName(name: string): string {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.includes("african location") ||
    lower.includes("africanlocations") ||
    lower === "african-location-api"
  ) {
    return "african-location-api";
  }
  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function uniqueSlug(base: string, taken: Set<string>): string {
  let slug = base || "api-product";
  if (!taken.has(slug)) return slug;
  let n = 2;
  while (taken.has(`${slug}-${n}`)) n += 1;
  return `${slug}-${n}`;
}

export function gatewayUrl(origin: string, slug: string, path = "") {
  const base = `${origin.replace(/\/$/, "")}/api/v1/${slug}`;
  return path ? `${base}/${path.replace(/^\//, "")}` : base;
}

export function buildGatewayCurl(
  origin: string,
  slug: string,
  apiKey: string,
  path = "",
) {
  return `curl -X GET "${gatewayUrl(origin, slug, path)}" \\\n  -H "Authorization: Bearer ${apiKey}" \\\n  -H "Content-Type: application/json"`;
}
