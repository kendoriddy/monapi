import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckoutForm } from "@/components/checkout-form";
import { DemoProductClientPage } from "@/components/demo-product-client-page";
import { ProductDocs } from "@/components/product-docs";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { getHeaderState } from "@/lib/header-state";
import { getAppOriginFromHeaders } from "@/lib/origin";
import { createServiceClient } from "@/lib/supabase/server";
import type { ApiProduct, SubscriptionPlan } from "@/lib/types";
import { buildGatewayCurl } from "@/lib/utils";

async function loadLiveProductBySlug(slug: string) {
  const supabase = createServiceClient();
  const { data: product } = await supabase
    .from("api_products")
    .select("*")
    .eq("slug", slug)
    .eq("is_live", true)
    .single();

  if (!product) return null;

  const { data: plans } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("product_id", product.id)
    .order("price_ngn", { ascending: true });

  return {
    product: product as ApiProduct,
    plans: (plans ?? []) as SubscriptionPlan[],
  };
}

export default async function PublicProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { experience, runtime, demo } = await getHeaderState();
  const origin = await getAppOriginFromHeaders();

  // Demo: always client shell reading localStorage catalog (seeded African Location API).
  if (demo) {
    return (
      <DemoProductClientPage
        slug={slug}
        experience={experience}
        runtime={runtime}
        origin={origin}
      />
    );
  }

  const data = await loadLiveProductBySlug(slug);
  if (!data) notFound();

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
            Subscribe
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
            demoMode={false}
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
