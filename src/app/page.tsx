import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GithubLoginButton } from "@/components/github-login-button";
import { OnboardingForm } from "@/components/onboarding-form";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo-store";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const user = await getCurrentUser();
  const demo = isDemoMode();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        right={
          user ? (
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-[var(--muted)] sm:inline">
                {user.fullName || user.email || "Developer"}
              </span>
              <Link href="#onboard">
                <Button size="sm">Open hub builder</Button>
              </Link>
            </div>
          ) : (
            <GithubLoginButton />
          )
        }
      />

      <main className="relative flex-1">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] grid-fade" />

        <section className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
          <div className="animate-in max-w-3xl">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              The Stripe Atlas for API Businesses in Africa
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

          <ol className="mt-14 grid gap-3 sm:grid-cols-4">
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
                title: "Purchase",
                body: "Customer pays via Monnify",
              },
              {
                step: "04",
                title: "Provision",
                body: "Monnify webhook delivers API key + email",
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
                <p className="mt-1 text-sm text-[var(--muted)]">{item.body}</p>
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
                Step 1 · Onboard (The Dev)
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
                  Authenticate to create products. In local demo mode without
                  Supabase env vars, you&apos;re signed in automatically.
                </p>
                <GithubLoginButton />
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)] py-6 text-center text-xs text-[var(--muted)]">
        Monapi · MonetizeAPI · Built for African API founders
      </footer>
    </div>
  );
}
