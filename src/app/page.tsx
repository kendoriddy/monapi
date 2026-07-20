import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { AuthErrorBanner } from "@/components/auth-error-banner";
import { GithubLoginButton } from "@/components/github-login-button";
import { MarketplaceGrid } from "@/components/marketplace-grid";
import { OnboardingForm } from "@/components/onboarding-form";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { demoListLiveProducts, isDemoMode } from "@/lib/demo-store";
import { getHeaderState } from "@/lib/header-state";
import { createServiceClient } from "@/lib/supabase/server";
import type { ApiProduct, SubscriptionPlan } from "@/lib/types";
import { Button } from "@/components/ui/button";

async function loadMarketplaceListings() {
  if (await isDemoMode()) {
    return demoListLiveProducts();
  }

  const supabase = createServiceClient();
  const { data: products } = await supabase
    .from("api_products")
    .select("*")
    .eq("is_live", true)
    .order("created_at", { ascending: false });

  if (!products?.length) return [];

  const ids = products.map((p) => p.id);
  const { data: plans } = await supabase
    .from("subscription_plans")
    .select("*")
    .in("product_id", ids)
    .order("price_ngn", { ascending: true });

  return (products as ApiProduct[]).map((product) => ({
    product,
    plans: ((plans ?? []) as SubscriptionPlan[]).filter(
      (plan) => plan.product_id === product.id,
    ),
  }));
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const { experience, runtime, liveAvailable, liveBlockedReason, demo } =
    await getHeaderState();
  const listings =
    experience === "subscriber" ? await loadMarketplaceListings() : [];

  return (
    <div className="flex min-h-screen flex-col">
      <Suspense fallback={null}>
        <AuthErrorBanner />
      </Suspense>
      <SiteHeader
        experience={experience}
        runtime={runtime}
        liveAvailable={liveAvailable}
        liveBlockedReason={liveBlockedReason}
        right={
          user ? (
            <span className="hidden text-sm text-[var(--muted)] lg:inline">
              {user.fullName || user.email || "Developer"}
            </span>
          ) : experience === "publisher" ? (
            <GithubLoginButton />
          ) : null
        }
      />

      <main className="relative flex-1">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] grid-fade" />

        {experience === "subscriber" ? (
          <>
            <section className="relative mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-6 sm:pt-20">
              <div className="animate-in max-w-3xl">
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                  Subscriber experience
                </p>
                <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-[var(--foreground)] sm:text-6xl">
                  Monapi
                </h1>
                <p className="mt-5 max-w-xl text-lg text-[var(--muted)]">
                  Browse live APIs, pick a plan in NGN, and get a provisioned{" "}
                  <code className="text-[var(--accent)]">sk_monapi_…</code> key
                  after checkout.
                </p>
              </div>

              <ol className="mt-14 grid gap-3 sm:grid-cols-3">
                {[
                  {
                    step: "01",
                    title: "Browse",
                    body: "Pick a live API from the marketplace",
                  },
                  {
                    step: "02",
                    title: "Subscribe",
                    body: "Pay with Monnify in Nigerian Naira",
                  },
                  {
                    step: "03",
                    title: "Call",
                    body: "Use your key on the Monapi gateway",
                  },
                ].map((item) => (
                  <li
                    key={item.step}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-4"
                  >
                    <p className="font-mono text-xs text-[var(--accent)]">
                      {item.step}
                    </p>
                    <p className="mt-2 font-semibold text-[var(--foreground)]">
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {item.body}
                    </p>
                  </li>
                ))}
              </ol>
            </section>

            <section className="border-t border-[var(--border)] bg-[var(--surface)]/40 py-14">
              <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <div className="mb-8 max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                    Marketplace
                  </p>
                  <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--foreground)]">
                    APIs ready to subscribe
                  </h2>
                  <p className="mt-2 text-[var(--muted)]">
                    These are published hubs. Open one to see docs, pricing, and
                    checkout.
                  </p>
                </div>
                <MarketplaceGrid listings={listings} />
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
              <div className="animate-in max-w-3xl">
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                  Publisher experience
                </p>
                <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-[var(--foreground)] sm:text-6xl">
                  Monapi
                </h1>
                <p className="mt-5 max-w-xl text-lg text-[var(--muted)]">
                  Paste an endpoint → MONAPI builds monetization plans → Monnify
                  Sandbox checkout → webhooks provision{" "}
                  <code className="text-[var(--accent)]">sk_monapi_…</code> keys
                  automatically.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  {user ? (
                    <a href="#onboard">
                      <Button size="lg">
                        Build your monetization hub
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </a>
                  ) : (
                    <GithubLoginButton />
                  )}
                  <Link href="/docs">
                    <Button variant="ghost" size="lg">
                      Setup guide
                    </Button>
                  </Link>
                </div>
              </div>

              <ol className="mt-14 grid gap-3 sm:grid-cols-3">
                {[
                  {
                    step: "01",
                    title: "Onboard",
                    body: "GitHub login + describe your API",
                  },
                  {
                    step: "02",
                    title: "Preview",
                    body: "Edit tiers & docs → Publish",
                  },
                  {
                    step: "03",
                    title: "Earn",
                    body: "Share your hub — subscribers pay via Monnify",
                  },
                ].map((item) => (
                  <li
                    key={item.step}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-4"
                  >
                    <p className="font-mono text-xs text-[var(--accent)]">
                      {item.step}
                    </p>
                    <p className="mt-2 font-semibold text-[var(--foreground)]">
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {item.body}
                    </p>
                  </li>
                ))}
              </ol>
            </section>

            <section
              id="onboard"
              className="border-t border-[var(--border)] bg-[var(--surface)]/40 py-14"
            >
              <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <div className="mb-8 max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                    Hub builder
                  </p>
                  <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--foreground)]">
                    Generate your monetization hub
                  </h2>
                  <p className="mt-2 text-[var(--muted)]">
                    {user
                      ? "Describe the API you want to sell. Monapi will draft Starter, Pro, and Enterprise tiers in NGN."
                      : "Sign in with GitHub to continue — or run in demo mode without Supabase."}
                  </p>
                </div>

                {user ? (
                  <OnboardingForm demoMode={demo} />
                ) : (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-8">
                    <p className="mb-4 text-sm text-[var(--muted)]">
                      Authenticate with GitHub to create products in Live mode.
                      Switch to Demo in the header to try without Supabase auth.
                    </p>
                    <GithubLoginButton />
                    <p className="mt-4 text-xs text-[var(--muted)]">
                      Supabase must allow{" "}
                      <code className="text-[var(--accent)]">
                        http://localhost:3000/auth/callback
                      </code>{" "}
                      under Authentication → URL Configuration, and GitHub must
                      be enabled under Authentication → Providers.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="border-t border-[var(--border)] py-6 text-center text-xs text-[var(--muted)]">
        Monapi · MonetizeAPI · Built for African API founders
      </footer>
    </div>
  );
}
