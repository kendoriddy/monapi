import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatNgn } from "@/lib/utils";
import type { ApiProduct, SubscriptionPlan } from "@/lib/types";

export function MarketplaceGrid({
  listings,
}: {
  listings: { product: ApiProduct; plans: SubscriptionPlan[] }[];
}) {
  if (listings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <p className="font-semibold text-[var(--foreground)]">
          No live APIs yet
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Switch to Publisher, create a hub, and publish it — it will show up
          here for subscribers.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {listings.map(({ product, plans }) => {
        const from = plans[0]?.price_ngn;
        return (
          <li key={product.id}>
            <Link
              href={`/p/${product.slug}`}
              className="group flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-5 transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--surface-2)]"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                Live API
              </p>
              <h3 className="mt-2 font-[family-name:var(--font-display)] text-xl font-bold text-[var(--foreground)]">
                {product.name}
              </h3>
              <p className="mt-2 line-clamp-3 flex-1 text-sm text-[var(--muted)]">
                {product.landing_copy || product.description}
              </p>
              <div className="mt-5 flex items-center justify-between gap-3">
                <p className="text-sm text-[var(--muted)]">
                  {from != null ? (
                    from === 0 && plans.length > 1 ? (
                      <>
                        Free · from{" "}
                        <span className="font-semibold text-[var(--foreground)]">
                          {formatNgn(plans[1].price_ngn)}
                        </span>
                      </>
                    ) : (
                      <>
                        From{" "}
                        <span className="font-semibold text-[var(--foreground)]">
                          {formatNgn(from)}
                        </span>
                        /mo
                      </>
                    )
                  ) : (
                    "View plans"
                  )}
                </p>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)]">
                  Subscribe
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
