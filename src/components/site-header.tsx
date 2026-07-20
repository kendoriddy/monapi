import Link from "next/link";
import { Zap } from "lucide-react";
import { HeaderControls } from "@/components/header-controls";
import type { Experience, RuntimeMode } from "@/lib/preferences";

export function SiteHeader({
  right,
  experience,
  runtime,
  liveAvailable,
  liveBlockedReason,
}: {
  right?: React.ReactNode;
  experience: Experience;
  runtime: RuntimeMode;
  liveAvailable: boolean;
  liveBlockedReason?: string;
}) {
  return (
    <header className="relative z-50 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
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
        <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
          <HeaderControls
            experience={experience}
            runtime={runtime}
            liveAvailable={liveAvailable}
            liveBlockedReason={liveBlockedReason}
          />
          {right}
        </div>
      </div>
    </header>
  );
}
