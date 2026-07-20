/**
 * Resolve the public site origin for redirects, emails, and curl snippets.
 * Prefer NEXT_PUBLIC_APP_URL in production so Vercel/proxy host headers can't
 * accidentally produce localhost URLs.
 */
export function getAppOrigin(request?: Request | null): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (request) {
    const host =
      request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const proto =
      request.headers.get("x-forwarded-proto") ??
      (process.env.VERCEL ? "https" : "http");
    if (host && !host.includes("localhost")) {
      return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
    }
    if (host) {
      return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
    }
    try {
      return new URL(request.url).origin;
    } catch {
      /* fall through */
    }
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}

export async function getAppOriginFromHeaders(): Promise<string> {
  const { headers } = await import("next/headers");
  const h = await headers();
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto =
    h.get("x-forwarded-proto") ?? (process.env.VERCEL ? "https" : "http");
  if (host) {
    return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}
