import Link from "next/link";
import { Zap } from "lucide-react";

export function SiteHeader({
  right,
}: {
  right?: React.ReactNode;
}) {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-fg)]">
            <Zap className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <p className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-[var(--foreground)]">
              Monapi
            </p>
            <p className="text-[11px] text-[var(--muted)]">MonetizeAPI</p>
          </div>
        </Link>
        <div className="flex items-center gap-3">{right}</div>
      </div>
    </header>
  );
}
