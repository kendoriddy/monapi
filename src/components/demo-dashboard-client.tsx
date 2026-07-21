"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { InsightsBanner } from "@/components/insights-banner";
import { PricingCards } from "@/components/pricing-cards";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import {
  getProductById,
  getSubscriptionsForProduct,
  seedCatalogIfEmpty,
} from "@/lib/demo-engine";
import { buildInsightsSummary } from "@/lib/insights";
import type { Experience, RuntimeMode } from "@/lib/runtime";
import type {
  ApiProduct,
  CustomerSubscription,
  SubscriptionPlan,
} from "@/lib/types";

type SubRow = CustomerSubscription & { plan: SubscriptionPlan | undefined };

export function DemoDashboardClient({
  productId,
  experience,
  runtime,
}: {
  productId: string;
  experience: Experience;
  runtime: RuntimeMode;
}) {
  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubRow[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      seedCatalogIfEmpty();
      const data = getProductById(productId);
      if (data) {
        setProduct(data.product);
        setPlans(data.plans);
        setSubscriptions(getSubscriptionsForProduct(productId));
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading dashboard…
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader experience={experience} runtime={runtime} />
        <main className="mx-auto max-w-lg flex-1 px-4 py-20 text-center">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">
            Product not found
          </h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            This demo product isn&apos;t in this browser&apos;s catalog.
          </p>
          <Link href="/" className="mt-6 inline-block">
            <Button size="sm">Back home</Button>
          </Link>
        </main>
      </div>
    );
  }

  const insight = buildInsightsSummary(
    subscriptions.filter(
      (s): s is CustomerSubscription & { plan: SubscriptionPlan } =>
        Boolean(s.plan),
    ),
    plans,
  );

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        experience={experience}
        runtime={runtime}
        right={
          product.is_live ? (
            <Link href={`/p/${product.slug}`}>
              <Button size="sm">Open public page</Button>
            </Link>
          ) : (
            <Link href="/">
              <Button size="sm" variant="secondary">
                Finish onboarding
              </Button>
            </Link>
          )
        }
      />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-12 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            Publisher dashboard · Demo
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--foreground)]">
            {product.name}
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Target: <code>{product.target_url}</code>
            {product.is_live ? " · Live" : " · Draft"}
          </p>
        </div>

        <InsightsBanner summary={insight} />

        <section>
          <h2 className="mb-4 text-lg font-semibold">Pricing tiers</h2>
          <PricingCards plans={plans} />
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold">
            Subscribers ({subscriptions.length})
          </h2>
          {subscriptions.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No customers yet. Share{" "}
              <Link
                className="text-[var(--accent)] underline"
                href={`/p/${product.slug}`}
              >
                /p/{product.slug}
              </Link>{" "}
              to start collecting payments.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--surface-2)] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Key</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((sub) => (
                    <tr
                      key={sub.id}
                      className="border-t border-[var(--border)]"
                    >
                      <td className="px-4 py-3">{sub.customer_email}</td>
                      <td className="px-4 py-3">{sub.plan?.name}</td>
                      <td className="px-4 py-3">{sub.status}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">
                        {sub.api_key.slice(0, 14)}…
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
