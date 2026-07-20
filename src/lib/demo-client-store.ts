import { DEMO_STORE_COOKIE } from "@/lib/runtime";
import type { ApiProduct, SubscriptionPlan } from "@/lib/types";

export type DemoClientCatalog = {
  products: ApiProduct[];
  plans: SubscriptionPlan[];
};

const STORAGE_KEY = "monapi.demo.catalog.v1";

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

function writeStorage(catalog: DemoClientCatalog) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
  // Mirror into a cookie so the next SSR request on Vercel can see it.
  try {
    const slim = JSON.stringify({
      products: catalog.products,
      plans: catalog.plans,
      subscriptions: [],
      pendingCheckouts: [],
    });
    if (slim.length < 3500) {
      document.cookie = `${DEMO_STORE_COOKIE}=${encodeURIComponent(slim)}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`;
    }
  } catch {
    /* ignore cookie quota */
  }
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
