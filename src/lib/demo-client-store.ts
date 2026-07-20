import { DEMO_STORE_COOKIE } from "@/lib/runtime";
import type { ApiProduct, SubscriptionPlan } from "@/lib/types";

export type DemoClientCatalog = {
  products: ApiProduct[];
  plans: SubscriptionPlan[];
};

export type DemoPendingCheckout = {
  paymentReference: string;
  planId: string;
  productId: string;
  customerEmail: string;
  customerName: string;
  amount: number;
  createdAt: string;
  productName?: string;
  planName?: string;
  productSlug?: string;
};

const STORAGE_KEY = "monapi.demo.catalog.v1";
const PENDING_KEY = "monapi.demo.pending.v1";

function readStorage(): DemoClientCatalog {
  if (typeof window === "undefined") {
    return { products: [], plans: [] };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { products: [], plans: [] };
    const parsed = JSON.parse(raw) as DemoClientCatalog;
    return {
      products: parsed.products ?? [],
      plans: parsed.plans ?? [],
    };
  } catch {
    return { products: [], plans: [] };
  }
}

function readPendingMap(): Record<string, DemoPendingCheckout> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, DemoPendingCheckout>;
  } catch {
    return {};
  }
}

function readCookieStoreSlice(): {
  subscriptions: unknown[];
  pendingCheckouts: DemoPendingCheckout[];
} {
  if (typeof document === "undefined") {
    return { subscriptions: [], pendingCheckouts: [] };
  }
  try {
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${DEMO_STORE_COOKIE}=`));
    if (!match) return { subscriptions: [], pendingCheckouts: [] };
    const raw = decodeURIComponent(match.slice(DEMO_STORE_COOKIE.length + 1));
    const parsed = JSON.parse(raw) as {
      subscriptions?: unknown[];
      pendingCheckouts?: DemoPendingCheckout[];
    };
    return {
      subscriptions: parsed.subscriptions ?? [],
      pendingCheckouts: parsed.pendingCheckouts ?? [],
    };
  } catch {
    return { subscriptions: [], pendingCheckouts: [] };
  }
}

function writeStorage(catalog: DemoClientCatalog) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
  // Mirror into a cookie so the next SSR request on Vercel can see it.
  // Never wipe pending checkouts or subscriptions — that breaks Monnify return.
  try {
    const existing = readCookieStoreSlice();
    const pendingByRef = new Map(
      existing.pendingCheckouts.map((p) => [p.paymentReference, p]),
    );
    for (const p of Object.values(readPendingMap())) {
      pendingByRef.set(p.paymentReference, p);
    }
    const slim = JSON.stringify({
      products: catalog.products.map((p) => ({
        ...p,
        docs_markdown: (p.docs_markdown ?? "").slice(0, 400),
      })),
      plans: catalog.plans,
      subscriptions: existing.subscriptions,
      pendingCheckouts: Array.from(pendingByRef.values()),
    });
    if (slim.length < 3500) {
      document.cookie = `${DEMO_STORE_COOKIE}=${encodeURIComponent(slim)}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`;
    }
  } catch {
    /* ignore cookie quota */
  }
}

/** Stash a pending checkout so /success can provision after Monnify redirect. */
export function persistDemoPendingCheckout(pending: DemoPendingCheckout) {
  if (typeof window === "undefined") return;
  const map = readPendingMap();
  map[pending.paymentReference] = pending;
  window.localStorage.setItem(PENDING_KEY, JSON.stringify(map));
  // Refresh cookie mirror with pending included.
  writeStorage(readStorage());
}

export function getDemoPendingCheckout(
  paymentReference: string,
): DemoPendingCheckout | null {
  return readPendingMap()[paymentReference] ?? null;
}

export function clearDemoPendingCheckout(paymentReference: string) {
  if (typeof window === "undefined") return;
  const map = readPendingMap();
  delete map[paymentReference];
  window.localStorage.setItem(PENDING_KEY, JSON.stringify(map));
}

/** Upsert a product + its plans into the browser demo catalog. */
export function persistDemoProduct(
  product: ApiProduct,
  plans: SubscriptionPlan[],
) {
  const catalog = readStorage();
  catalog.products = [
    product,
    ...catalog.products.filter((p) => p.id !== product.id),
  ];
  const otherPlans = catalog.plans.filter((p) => p.product_id !== product.id);
  catalog.plans = [...plans, ...otherPlans];
  writeStorage(catalog);
}

export function getDemoProductBySlugClient(slug: string): {
  product: ApiProduct;
  plans: SubscriptionPlan[];
} | null {
  const catalog = readStorage();
  const product =
    catalog.products.find((p) => p.slug === slug && p.is_live) ?? null;
  if (!product) return null;
  const plans = catalog.plans
    .filter((p) => p.product_id === product.id)
    .sort((a, b) => a.price_ngn - b.price_ngn);
  return { product, plans };
}

export function listLiveDemoProductsClient(): {
  product: ApiProduct;
  plans: SubscriptionPlan[];
}[] {
  const catalog = readStorage();
  const seen = new Set<string>();
  const out: { product: ApiProduct; plans: SubscriptionPlan[] }[] = [];
  for (const product of catalog.products) {
    if (!product.is_live || seen.has(product.slug)) continue;
    seen.add(product.slug);
    out.push({
      product,
      plans: catalog.plans
        .filter((p) => p.product_id === product.id)
        .sort((a, b) => a.price_ngn - b.price_ngn),
    });
  }
  return out;
}
