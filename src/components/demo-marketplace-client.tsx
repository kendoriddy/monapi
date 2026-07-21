"use client";

import { useEffect, useState } from "react";
import { MarketplaceGrid } from "@/components/marketplace-grid";
import { listLiveProducts, seedCatalogIfEmpty } from "@/lib/demo-engine";
import type { ApiProduct, SubscriptionPlan } from "@/lib/types";

export function DemoMarketplaceClient() {
  const [listings, setListings] = useState<
    { product: ApiProduct; plans: SubscriptionPlan[] }[]
  >([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      seedCatalogIfEmpty();
      setListings(listLiveProducts());
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return <p className="text-sm text-[var(--muted)]">Loading marketplace…</p>;
  }

  return <MarketplaceGrid listings={listings} />;
}
