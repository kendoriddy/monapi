import Link from "next/link";
import { notFound } from "next/navigation";
import { InsightsBanner } from "@/components/insights-banner";
import { PricingCards } from "@/components/pricing-cards";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import {
  demoGetProduct,
  demoGetSubscriptionsForProduct,
  isDemoMode,
} from "@/lib/demo-store";
import { buildInsightsSummary } from "@/lib/insights";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { ApiProduct, SubscriptionPlan } from "@/lib/types";

export default async function DashboardProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const user = await getCurrentUser();

  let product: ApiProduct | null = null;
  let plans: SubscriptionPlan[] = [];
  let subscriptions: Awaited<
    ReturnType<typeof demoGetSubscriptionsForProduct>
  > = [];

  if (isDemoMode()) {
    const result = await demoGetProduct(productId);
    product = result.product;
    plans = result.plans;
    subscriptions = await demoGetSubscriptionsForProduct(productId);
  } else {
    if (!user) notFound();
    const supabase = await createClient();
    const { data } = await supabase
      .from("api_products")
      .select("*")
      .eq("id", productId)
      .eq("developer_id", user.id)
      .single();
    product = data;

    if (product) {
      const { data: planRows } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("product_id", productId)
        .order("price_ngn", { ascending: true });
      plans = (planRows ?? []) as SubscriptionPlan[];

      const service = createServiceClient();
      const planIds = plans.map((p) => p.id);
      if (planIds.length) {
        const { data: subs } = await service
          .from("customer_subscriptions")
          .select("*")
          .in("plan_id", planIds);
        subscriptions = (subs ?? []).map((s) => ({
          ...s,
          plan: plans.find((p) => p.id === s.plan_id)!,
        }));
      }
    }
  }

  if (!product) notFound();

  const insight = buildInsightsSummary(
    subscriptions.filter((s) => s.plan),
    plans,
  );

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
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
            Developer dashboard
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
