"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

export function AuthErrorBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get("authError");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!raw) return;
    const decoded =
      raw === "1"
        ? "Could not complete GitHub sign-in. Check Supabase GitHub provider + redirect URLs."
        : decodeURIComponent(raw);
    setMessage(decoded);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("authError");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, raw, router, searchParams]);

  if (!message) return null;

  return (
    <div
      role="alert"
      className="flex items-start justify-center gap-3 border-b border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
    >
      <p className="text-center">GitHub sign-in failed: {message}</p>
      <button
        type="button"
        aria-label="Dismiss"
        className="shrink-0 rounded p-0.5 hover:bg-red-500/20"
        onClick={() => setMessage(null)}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
