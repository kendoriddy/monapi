import { promises as fs } from "fs";
import path from "path";
import type {
  ApiProduct,
  CustomerSubscription,
  EmailPreview,
  SubscriptionPlan,
} from "@/lib/types";
import { slugifyProductName, uniqueSlug } from "@/lib/utils";

type PendingCheckout = {
  paymentReference: string;
  planId: string;
  productId: string;
  customerEmail: string;
  customerName: string;
  amount: number;
  createdAt: string;
};

type DemoStore = {
  products: ApiProduct[];
  plans: SubscriptionPlan[];
  subscriptions: CustomerSubscription[];
  pendingCheckouts: PendingCheckout[];
};

const STORE_PATH = path.join(process.cwd(), ".data", "demo-store.json");

const emptyStore = (): DemoStore => ({
  products: [],
  plans: [],
  subscriptions: [],
  pendingCheckouts: [],
});

function normalizeProduct(p: ApiProduct): ApiProduct {
  return {
    ...p,
    slug: p.slug ?? slugifyProductName(p.name),
    docs_markdown: p.docs_markdown ?? null,
  };
}

function normalizeSubscription(s: CustomerSubscription): CustomerSubscription {
  return {
    ...s,
    requests_this_month: s.requests_this_month ?? 0,
    usage_reset_at: s.usage_reset_at ?? null,
    email_preview: s.email_preview ?? null,
  };
}

async function ensureStore(): Promise<DemoStore> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as DemoStore;
    return {
      ...parsed,
      products: (parsed.products ?? []).map(normalizeProduct),
      subscriptions: (parsed.subscriptions ?? []).map(normalizeSubscription),
    };
  } catch {
    const store = emptyStore();
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2));
    return store;
  }
}

async function writeStore(store: DemoStore) {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2));
}

export function isSupabaseConfiguredForProd() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !key) return false;
  if (
    url.includes("YOUR_PROJECT") ||
    key.startsWith("your_") ||
    key === "your_anon_key"
  ) {
    return false;
  }
  return true;
}

/**
 * Demo uses the local `.data/demo-store.json` backend.
 * Controlled by the Demo/Live header toggle (cookie), or MONAPI_DEMO_MODE=true.
 */
export async function isDemoMode() {
  const { resolveDemoModeFromPreference, getRuntimePreference } =
    await import("@/lib/preferences");
  try {
    const preference = await getRuntimePreference();
    return resolveDemoModeFromPreference(preference);
  } catch {
    return resolveDemoModeFromPreference(undefined);
  }
}

export async function demoCreateProduct(input: {
  developerId: string;
  name: string;
  targetUrl: string;
  description: string;
  landingCopy: string;
  docsMarkdown: string;
  slug?: string;
  tiers: {
    name: string;
    price_ngn: number;
    limit_per_month: number;
    features: string[];
  }[];
}) {
  const store = await ensureStore();
  const taken = new Set(store.products.map((p) => p.slug));
  const base = input.slug ?? slugifyProductName(input.name);
  const slug = uniqueSlug(base, taken);

  const product: ApiProduct = {
    id: crypto.randomUUID(),
    developer_id: input.developerId,
    name: input.name,
    target_url: input.targetUrl,
    description: input.description,
    landing_copy: input.landingCopy,
    slug,
    docs_markdown: input.docsMarkdown,
    is_live: false,
    created_at: new Date().toISOString(),
  };

  const plans: SubscriptionPlan[] = input.tiers.map((tier) => ({
    id: crypto.randomUUID(),
    product_id: product.id,
    name: tier.name,
    price_ngn: tier.price_ngn,
    limit_per_month: tier.limit_per_month,
    features: tier.features,
    monnify_plan_code: null,
    created_at: new Date().toISOString(),
  }));

  store.products.push(product);
  store.plans.push(...plans);
  await writeStore(store);
  return { product, plans };
}

export async function demoGetProduct(productId: string) {
  const store = await ensureStore();
  const product = store.products.find((p) => p.id === productId) ?? null;
  const plans = store.plans.filter((p) => p.product_id === productId);
  return { product, plans };
}

export async function demoGetProductBySlug(slug: string) {
  const store = await ensureStore();
  const product =
    store.products.find((p) => p.slug === slug && p.is_live) ?? null;
  const plans = product
    ? store.plans.filter((p) => p.product_id === product.id)
    : [];
  return { product, plans };
}

export async function demoPublishProduct(productId: string) {
  const store = await ensureStore();
  const product = store.products.find((p) => p.id === productId);
  if (!product) throw new Error("Product not found");
  product.is_live = true;
  await writeStore(store);
  return product;
}

export async function demoUpdateProductHub(
  productId: string,
  input: {
    landingCopy: string;
    docsMarkdown: string;
    tiers: {
      id: string;
      price_ngn: number;
      limit_per_month: number;
      features: string[];
      description?: string;
    }[];
  },
) {
  const store = await ensureStore();
  const product = store.products.find((p) => p.id === productId);
  if (!product) throw new Error("Product not found");

  product.landing_copy = input.landingCopy;
  product.docs_markdown = input.docsMarkdown;

  for (const tier of input.tiers) {
    const plan = store.plans.find(
      (p) => p.id === tier.id && p.product_id === productId,
    );
    if (!plan) continue;
    plan.price_ngn = plan.name === "Pro" ? 15000 : tier.price_ngn;
    plan.limit_per_month = tier.limit_per_month;
    plan.features = tier.features;
  }

  await writeStore(store);
  const plans = store.plans.filter((p) => p.product_id === productId);
  return { product, plans };
}

export async function demoListDeveloperProducts(developerId: string) {
  const store = await ensureStore();
  return store.products.filter((p) => p.developer_id === developerId);
}

export async function demoListLiveProducts() {
  const store = await ensureStore();
  const seen = new Set<string>();
  const listings: { product: ApiProduct; plans: SubscriptionPlan[] }[] = [];

  for (const product of store.products) {
    if (!product.is_live) continue;
    if (seen.has(product.slug)) continue;
    seen.add(product.slug);
    listings.push({
      product,
      plans: store.plans
        .filter((p) => p.product_id === product.id)
        .sort((a, b) => a.price_ngn - b.price_ngn),
    });
  }

  return listings;
}

export async function demoSavePendingCheckout(checkout: PendingCheckout) {
  const store = await ensureStore();
  store.pendingCheckouts = store.pendingCheckouts.filter(
    (c) => c.paymentReference !== checkout.paymentReference,
  );
  store.pendingCheckouts.push(checkout);
  await writeStore(store);
}

export async function demoGetPendingCheckout(paymentReference: string) {
  const store = await ensureStore();
  return (
    store.pendingCheckouts.find(
      (c) => c.paymentReference === paymentReference,
    ) ?? null
  );
}

export async function demoProvisionSubscription(input: {
  planId: string;
  customerEmail: string;
  customerName: string;
  apiKey: string;
  monnifyTransactionReference: string;
  emailPreview?: EmailPreview | null;
}) {
  const store = await ensureStore();
  const existing = store.subscriptions.find(
    (s) =>
      s.monnify_transaction_reference === input.monnifyTransactionReference,
  );
  if (existing) return existing;

  const subscription: CustomerSubscription = {
    id: crypto.randomUUID(),
    plan_id: input.planId,
    customer_email: input.customerEmail,
    customer_name: input.customerName,
    api_key: input.apiKey,
    status: "active",
    monnify_transaction_reference: input.monnifyTransactionReference,
    requests_this_month: 0,
    usage_reset_at: new Date().toISOString(),
    email_preview: input.emailPreview ?? null,
    created_at: new Date().toISOString(),
  };

  store.subscriptions.push(subscription);
  store.pendingCheckouts = store.pendingCheckouts.filter(
    (c) => c.paymentReference !== input.monnifyTransactionReference,
  );
  await writeStore(store);
  return subscription;
}

export async function demoGetSubscriptionByReference(reference: string) {
  const store = await ensureStore();
  return (
    store.subscriptions.find(
      (s) =>
        s.monnify_transaction_reference === reference || s.id === reference,
    ) ?? null
  );
}

export async function demoGetSubscriptionByApiKey(apiKey: string) {
  const store = await ensureStore();
  const sub = store.subscriptions.find(
    (s) => s.api_key === apiKey && s.status === "active",
  );
  if (!sub) return null;
  const plan = store.plans.find((p) => p.id === sub.plan_id);
  const product = plan
    ? store.products.find((p) => p.id === plan.product_id)
    : null;
  return { subscription: sub, plan: plan ?? null, product: product ?? null };
}

export async function demoIncrementUsage(subscriptionId: string) {
  const store = await ensureStore();
  const sub = store.subscriptions.find((s) => s.id === subscriptionId);
  if (!sub) return null;
  sub.requests_this_month = (sub.requests_this_month ?? 0) + 1;
  await writeStore(store);
  return sub;
}

export async function demoGetSubscriptionsForProduct(productId: string) {
  const store = await ensureStore();
  const planIds = new Set(
    store.plans.filter((p) => p.product_id === productId).map((p) => p.id),
  );
  return store.subscriptions
    .filter((s) => planIds.has(s.plan_id))
    .map((s) => {
      const plan = store.plans.find((p) => p.id === s.plan_id)!;
      return { ...s, plan };
    });
}

export async function demoGetSubscriptionDetails(reference: string) {
  const store = await ensureStore();
  const sub = store.subscriptions.find(
    (s) => s.monnify_transaction_reference === reference || s.id === reference,
  );
  if (!sub) return null;

  const plan = store.plans.find((p) => p.id === sub.plan_id);
  const product = plan
    ? store.products.find((p) => p.id === plan.product_id)
    : null;

  return {
    subscription: sub,
    plan: plan ?? null,
    product: product ?? null,
  };
}
