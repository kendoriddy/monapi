import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SuccessPanel } from "@/components/success-panel";
import { Button } from "@/components/ui/button";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        right={
          <Link href="/">
            <Button variant="ghost" size="sm">
              Back home
            </Button>
          </Link>
        }
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-6">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
          Step 4 · Webhook provisioning
        </p>
        {ref ? (
          <SuccessPanel paymentRef={ref} />
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
            Missing payment reference. Complete a checkout from a live product
            page to land here with your API key.
          </div>
        )}
      </main>
    </div>
  );
}
