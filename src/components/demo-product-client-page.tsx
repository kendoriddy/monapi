"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Pencil } from "lucide-react";
import { CheckoutForm } from "@/components/checkout-form";
import { PricingCards } from "@/components/pricing-cards";
import { ProductDocs } from "@/components/product-docs";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getProductBySlug,
  seedCatalogIfEmpty,
  updateProductContent,
} from "@/lib/demo-engine";
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
  const isPublisher = experience === "publisher";
  const [data, setData] = useState<{
    product: ApiProduct;
    plans: SubscriptionPlan[];
  } | null>(null);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [landingCopy, setLandingCopy] = useState("");
  const [docsMarkdown, setDocsMarkdown] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      seedCatalogIfEmpty();
      const next = getProductBySlug(slug);
      setData(next);
      if (next) {
        setLandingCopy(next.product.landing_copy ?? "");
        setDocsMarkdown(next.product.docs_markdown ?? "");
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  function startEditing() {
    if (!data) return;
    setLandingCopy(data.product.landing_copy ?? "");
    setDocsMarkdown(data.product.docs_markdown ?? "");
    setSaveError(null);
    setEditing(true);
  }

  function saveEdits() {
    if (!data) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = updateProductContent({
        productId: data.product.id,
        landingCopy,
        docsMarkdown,
      });
      if (!updated) {
        setSaveError("Could not save — product missing from demo catalog.");
        return;
      }
      setData({ product: updated, plans: data.plans });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

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
    product.slug === "african-location-api" ? "states" : "",
  );

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        experience={experience}
        runtime={runtime}
        right={
          <div className="flex items-center gap-2">
            {isPublisher ? (
              editing ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" disabled={saving} onClick={saveEdits}>
                    {saving ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Save"
                    )}
                  </Button>
                </>
              ) : (
                <Button variant="secondary" size="sm" onClick={startEditing}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              )
            ) : null}
            <Link href={`/dashboard/${product.id}`}>
              <Button variant="ghost" size="sm">
                Publisher dashboard
              </Button>
            </Link>
          </div>
        }
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6">
        <div className="animate-in mb-12 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            {isPublisher ? "Your hub · Demo" : "Subscribe · Demo"}
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-[var(--foreground)]">
            {product.name}
          </h1>
          {editing ? (
            <div className="mt-4">
              <Label htmlFor="hub-landing">Landing copy</Label>
              <Textarea
                id="hub-landing"
                className="mt-1.5 min-h-[80px]"
                value={landingCopy}
                onChange={(e) => setLandingCopy(e.target.value)}
              />
            </div>
          ) : (
            <p className="mt-3 text-[var(--muted)]">
              {product.landing_copy || product.description}
            </p>
          )}
          {isPublisher && !editing ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              This is your published hub. Subscribers see pricing and checkout
              here — switch to{" "}
              <strong className="text-[var(--foreground)]">Subscriber</strong>{" "}
              in the header to try that flow.
            </p>
          ) : null}
        </div>

        {isPublisher ? (
          <section className="mb-14">
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold text-[var(--foreground)]">
              Pricing tiers
            </h2>
            <PricingCards plans={plans} />
          </section>
        ) : (
          <section className="mb-14">
            <CheckoutForm
              productId={product.id}
              productName={product.name}
              plans={plans}
              demoMode
            />
          </section>
        )}

        <section className="mb-14 space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--foreground)]">
              Documentation
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {isPublisher
                ? "What your API consumers see after they open this hub."
                : "Auto-generated quickstart for your API consumers."}
            </p>
          </div>
          {editing ? (
            <div>
              <Label htmlFor="hub-docs">Docs (markdown)</Label>
              <Textarea
                id="hub-docs"
                className="mt-1.5 min-h-[280px] font-mono text-xs"
                value={docsMarkdown}
                onChange={(e) => setDocsMarkdown(e.target.value)}
              />
            </div>
          ) : product.docs_markdown ? (
            <ProductDocs markdown={product.docs_markdown} />
          ) : (
            <p className="text-sm text-[var(--muted)]">Docs coming soon.</p>
          )}
          {saveError ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {saveError}
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--foreground)]">
            Quick start
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {isPublisher
              ? "Example curl subscribers will use with their provisioned key."
              : "Replace the placeholder key after subscribing."}
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 font-mono text-xs leading-relaxed text-[var(--foreground)]">
            {quickstartCurl}
          </pre>
        </section>
      </main>
    </div>
  );
}
