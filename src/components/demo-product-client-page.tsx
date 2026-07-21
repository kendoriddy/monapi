"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckoutForm } from "@/components/checkout-form";
import { ProductDocs } from "@/components/product-docs";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { getProductBySlug, seedCatalogIfEmpty } from "@/lib/demo-engine";
import type { Experience, RuntimeMode } from "@/lib/runtime";
import type { ApiProduct, SubscriptionPlan } from "@/lib/types";
import { buildGatewayCurl } from "@/lib/utils";

export function DemoProductClientPage({
  slug,
  experience,
  runtime,
  origin,
}: {
  slug: string;
  experience: Experience;
  runtime: RuntimeMode;
  origin: string;
}) {
  const [data, setData] = useState<{
    product: ApiProduct;
    plans: SubscriptionPlan[];
  } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      seedCatalogIfEmpty();
      setData(getProductBySlug(slug));
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading demo product…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader experience={experience} runtime={runtime} />
        <main className="mx-auto max-w-lg flex-1 px-4 py-20 text-center">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">
            Page not found
          </h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            That demo product isn&apos;t in this browser&apos;s demo catalog.
            Publish it again from Demo mode, then open the link in the same
            browser.
          </p>
          <Link href="/" className="mt-6 inline-block">
            <Button size="sm">Back home</Button>
          </Link>
        </main>
      </div>
    );
  }

  const { product, plans } = data;
  const quickstartCurl = buildGatewayCurl(
    origin,
    product.slug,
    "sk_monapi_your_key",
  );

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        experience={experience}
        runtime={runtime}
        right={
          <Link href={`/dashboard/${product.id}`}>
            <Button variant="ghost" size="sm">
              Publisher dashboard
            </Button>
          </Link>
        }
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6">
        <div className="animate-in mb-12 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            Subscribe · Demo
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-[var(--foreground)]">
            {product.name}
          </h1>
          <p className="mt-3 text-[var(--muted)]">
            {product.landing_copy || product.description}
          </p>
        </div>

        <section className="mb-14">
          <CheckoutForm
            productId={product.id}
            productName={product.name}
            plans={plans}
            demoMode
          />
        </section>

        <section className="mb-14 space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--foreground)]">
              Documentation
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Auto-generated quickstart for your API consumers.
            </p>
          </div>
          {product.docs_markdown ? (
            <ProductDocs markdown={product.docs_markdown} />
          ) : (
            <p className="text-sm text-[var(--muted)]">Docs coming soon.</p>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--foreground)]">
            Quick start
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Replace the placeholder key after subscribing.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 font-mono text-xs leading-relaxed text-[var(--foreground)]">
            {quickstartCurl}
          </pre>
        </section>
      </main>
    </div>
  );
}
