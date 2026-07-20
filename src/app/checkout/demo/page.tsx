import { Suspense } from "react";
import Link from "next/link";
import { DemoMonnifyCheckout } from "@/components/demo-monnify-checkout";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export default function DemoCheckoutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      <SiteHeader
        right={
          <Link href="/">
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </Link>
        }
      />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-12">
        <Suspense
          fallback={
            <p className="text-center text-sm text-[var(--muted)]">
              Loading checkout…
            </p>
          }
        >
          <DemoMonnifyCheckout />
        </Suspense>
      </main>
    </div>
  );
}
