import { Sparkles } from "lucide-react";

export function InsightsBanner({ summary }: { summary: string }) {
  return (
    <div className="rounded-xl border border-[var(--accent)]/30 bg-[linear-gradient(135deg,rgba(45,212,191,0.12),rgba(15,23,42,0.4))] p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent)]">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            Monapi Insights
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
            {summary}
          </p>
        </div>
      </div>
    </div>
  );
}
