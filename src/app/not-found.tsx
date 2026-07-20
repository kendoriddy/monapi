import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
        404
      </p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold">
        Page not found
      </h1>
      <p className="mt-2 max-w-md text-sm text-[var(--muted)]">
        That product may be unpublished, or the link is incomplete.
      </p>
      <Link href="/" className="mt-6">
        <Button>Back to Monapi</Button>
      </Link>
    </div>
  );
}
