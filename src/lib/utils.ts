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

/** Demo-friendly slug: PlateReader OCR → plate-reader */
export function slugifyProductName(name: string): string {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.includes("platereader") ||
    lower.includes("plate reader") ||
    lower.includes("plate-reader")
  ) {
    return "plate-reader";
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

export function buildGatewayCurl(origin: string, slug: string, apiKey: string) {
  return `curl -X GET "${gatewayUrl(origin, slug)}" \\\n  -H "Authorization: Bearer ${apiKey}" \\\n  -H "Content-Type: application/json"`;
}
