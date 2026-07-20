import { promises as fs } from "fs";
import path from "path";
import type { NextResponse } from "next/server";
import { DEMO_STORE_COOKIE } from "@/lib/runtime";
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

export type DemoStore = {
  products: ApiProduct[];
  plans: SubscriptionPlan[];
  subscriptions: CustomerSubscription[];
  pendingCheckouts: PendingCheckout[];
};

const STORE_PATH = path.join(process.cwd(), ".data", "demo-store.json");

type GlobalDemo = typeof globalThis & {
  __monapiDemoStore?: DemoStore;
  __monapiDemoUseMemory?: boolean;
  /** Set after in-request writes so ensureStore doesn't clobber them with cookie. */
  __monapiDemoDirty?: boolean;
};

const emptyStore = (): DemoStore => ({
  products: [],
  plans: [],
  subscriptions: [],
  pendingCheckouts: [],
});

function preferMemoryStore() {
  // Vercel (and similar) have no durable local disk for `.data/`.
  return (
    process.env.VERCEL === "1" || process.env.MONAPI_DEMO_MEMORY === "true"
  );
}

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

function normalizeStore(parsed: DemoStore): DemoStore {
  return {
    products: (parsed.products ?? []).map(normalizeProduct),
    plans: parsed.plans ?? [],
    subscriptions: (parsed.subscriptions ?? []).map(normalizeSubscription),
    pendingCheckouts: parsed.pendingCheckouts ?? [],
  };
}

function memoryStore(): DemoStore {
  const g = globalThis as GlobalDemo;
  if (!g.__monapiDemoStore) {
    g.__monapiDemoStore = emptyStore();
  }
  return g.__monapiDemoStore;
}

export function parseDemoStoreCookie(
  raw: string | undefined | null,
): DemoStore | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DemoStore;
    return normalizeStore(parsed);
  } catch {
    try {
      const parsed = JSON.parse(decodeURIComponent(raw)) as DemoStore;
      return normalizeStore(parsed);
    } catch {
      return null;
    }
  }
}

/** Slim payload for the browser cookie — keep under typical 4KB limits. */
export function serializeDemoStore(store: DemoStore): string {
  const payload: DemoStore = {
    products: store.products.map((p) => ({
      ...p,
      // Docs live in localStorage; cookie only needs identity + copy snippet.
      docs_markdown: (p.docs_markdown ?? "").slice(0, 180),
      landing_copy: (p.landing_copy ?? "").slice(0, 220),
      description: (p.description ?? "").slice(0, 120),
    })),
    plans: store.plans.map((p) => ({
      ...p,
      features: (p.features ?? []).slice(0, 6).map((f) => f.slice(0, 80)),
    })),
    subscriptions: store.subscriptions.map((s) => ({
      ...s,
      // HTML preview blows past cookie limits and breaks later PATCH/reconcile.
      email_preview: null,
    })),
    pendingCheckouts: store.pendingCheckouts.slice(-8),
  };
  return JSON.stringify(payload);
}

export function attachDemoStoreCookie(
  response: NextResponse,
  store: DemoStore,
) {
  response.cookies.set(DEMO_STORE_COOKIE, serializeDemoStore(store), {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

async function readDemoCookieValue(): Promise<string | undefined> {
  try {
    const { cookies } = await import("next/headers");
    return (await cookies()).get(DEMO_STORE_COOKIE)?.value;
  } catch {
    return undefined;
  }
}

function mergeDemoStores(base: DemoStore, overlay: DemoStore): DemoStore {
  const productsById = new Map<string, ApiProduct>();
  for (const p of base.products) productsById.set(p.id, p);
  for (const p of overlay.products) productsById.set(p.id, p);

  const plansById = new Map<string, SubscriptionPlan>();
  for (const p of base.plans) plansById.set(p.id, p);
  for (const p of overlay.plans) plansById.set(p.id, p);

  const subsByRef = new Map<string, CustomerSubscription>();
  for (const s of base.subscriptions) {
    subsByRef.set(s.monnify_transaction_reference || s.id, s);
  }
  for (const s of overlay.subscriptions) {
    subsByRef.set(s.monnify_transaction_reference || s.id, s);
  }

  const pendingByRef = new Map<string, PendingCheckout>();
  for (const p of base.pendingCheckouts) {
    pendingByRef.set(p.paymentReference, p);
  }
  for (const p of overlay.pendingCheckouts) {
    pendingByRef.set(p.paymentReference, p);
  }

  return {
    products: Array.from(productsById.values()),
    plans: Array.from(plansById.values()),
    subscriptions: Array.from(subsByRef.values()),
    pendingCheckouts: Array.from(pendingByRef.values()),
  };
}

async function ensureStore(): Promise<DemoStore> {
  const g = globalThis as GlobalDemo;
  const cookieStore = parseDemoStoreCookie(await readDemoCookieValue());

  // In-request writes must win — otherwise upsert→ensureStore reloads the
  // stale cookie and drops the product we just rehydrated (PATCH 404).
  if (g.__monapiDemoDirty && g.__monapiDemoStore) {
    g.__monapiDemoUseMemory = true;
    if (cookieStore) {
      g.__monapiDemoStore = mergeDemoStores(cookieStore, g.__monapiDemoStore);
    }
    return g.__monapiDemoStore;
  }

  // Cookie is the source of truth across Vercel serverless isolates.
  if (cookieStore) {
    g.__monapiDemoUseMemory = true;
    if (g.__monapiDemoStore) {
      g.__monapiDemoStore = mergeDemoStores(cookieStore, g.__monapiDemoStore);
    } else {
      g.__monapiDemoStore = cookieStore;
    }
    return g.__monapiDemoStore;
  }

  if (g.__monapiDemoUseMemory || preferMemoryStore()) {
    g.__monapiDemoUseMemory = true;
    return memoryStore();
  }

  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as DemoStore;
    return normalizeStore(parsed);
  } catch {
    // Local disk unavailable (e.g. serverless) — fall back to memory.
    try {
      const store = emptyStore();
      await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
      await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2));
      return store;
    } catch {
      console.warn(
        "[demo-store] filesystem unavailable — using in-memory demo store",
      );
      g.__monapiDemoUseMemory = true;
      return memoryStore();
    }
  }
}

async function writeStore(store: DemoStore) {
  const g = globalThis as GlobalDemo;
  g.__monapiDemoStore = store;
  g.__monapiDemoDirty = true;

  if (g.__monapiDemoUseMemory || preferMemoryStore()) {
    g.__monapiDemoUseMemory = true;
    return;
  }

  try {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2));
  } catch {
    console.warn(
      "[demo-store] write failed — switching to in-memory demo store",
    );
    g.__monapiDemoUseMemory = true;
  }
}

/** Current demo store snapshot (for Set-Cookie on API responses). */
export async function getDemoStoreSnapshot(): Promise<DemoStore> {
  return ensureStore();
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
 * Demo uses the local `.data/demo-store.json` backend — never Supabase / Monnify / AI.
 * Prefer the request header (UI toggle), then cookie, then MONAPI_DEMO_MODE.
 */
export async function isDemoMode(request?: Request) {
  const { RUNTIME_HEADER } = await import("@/lib/runtime");
  const { getRuntimePreference, resolveDemoModeFromPreference } =
    await import("@/lib/preferences");

  if (process.env.MONAPI_DEMO_MODE === "true") return true;

  const header = request?.headers.get(RUNTIME_HEADER)?.toLowerCase();
  if (header === "demo") return true;
  if (header === "live") return false;

  try {
    const preference = await getRuntimePreference();
    return resolveDemoModeFromPreference(preference);
  } catch {
    return false;
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

export async function demoPublishProduct(
  productId: string,
  snapshot?: { product: ApiProduct; plans: SubscriptionPlan[] } | null,
) {
  const store = await ensureStore();
  let product = store.products.find((p) => p.id === productId);

  if (!product && snapshot?.product?.id === productId) {
    await demoUpsertProductSnapshot({
      product: { ...snapshot.product, is_live: true },
      plans: snapshot.plans,
    });
    return (
      (await ensureStore()).products.find((p) => p.id === productId) ?? null
    );
  }

  if (!product) return null;
  product.is_live = true;
  await writeStore(store);
  return product;
}

/** Rehydrate a product/plans the browser still has when the cookie was dropped. */
export async function demoUpsertProductSnapshot(input: {
  product: ApiProduct;
  plans: SubscriptionPlan[];
}) {
  const store = await ensureStore();
  store.products = [
    normalizeProduct(input.product),
    ...store.products.filter((p) => p.id !== input.product.id),
  ];
  const otherPlans = store.plans.filter(
    (p) => p.product_id !== input.product.id,
  );
  store.plans = [...input.plans, ...otherPlans];
  await writeStore(store);
}

export async function demoUpdateProductHub(
  productId: string,
  input: {
    landingCopy: string;
    docsMarkdown: string;
    tiers: {
      id: string;
      name?: string;
      price_ngn: number;
      limit_per_month: number;
      features: string[];
      description?: string;
    }[];
    /** Browser catalog snapshot when Vercel cookie lost the product. */
    snapshot?: { product: ApiProduct; plans: SubscriptionPlan[] } | null;
    /** Minimal fields to synthesize a product if snapshot is incomplete. */
    synthesize?: {
      developerId: string;
      name?: string;
      slug?: string;
      targetUrl?: string;
      description?: string;
    } | null;
  },
) {
  let store = await ensureStore();
  let product = store.products.find((p) => p.id === productId);

  if (!product && input.snapshot?.product?.id === productId) {
    await demoUpsertProductSnapshot(input.snapshot);
    store = await ensureStore();
    product = store.products.find((p) => p.id === productId);
  }

  // Last resort: rebuild from PATCH body so publish never depends on cookie.
  if (!product && input.synthesize) {
    const name = input.synthesize.name?.trim() || "API Product";
    const slug =
      input.synthesize.slug?.trim() ||
      slugifyProductName(name) ||
      `api-${productId.slice(0, 8)}`;
    const synthesized: ApiProduct = {
      id: productId,
      developer_id: input.synthesize.developerId,
      name,
      target_url: input.synthesize.targetUrl || "https://api.example.com",
      description: input.synthesize.description ?? null,
      landing_copy: input.landingCopy,
      slug,
      docs_markdown: input.docsMarkdown,
      is_live: false,
      created_at: new Date().toISOString(),
    };
    const plans: SubscriptionPlan[] = input.tiers.map((tier, index) => ({
      id: tier.id || crypto.randomUUID(),
      product_id: productId,
      name:
        tier.name || ["Free", "Pro", "Business"][index] || `Tier ${index + 1}`,
      price_ngn: tier.price_ngn,
      limit_per_month: tier.limit_per_month,
      features: tier.features,
      monnify_plan_code: null,
      created_at: new Date().toISOString(),
    }));
    await demoUpsertProductSnapshot({ product: synthesized, plans });
    store = await ensureStore();
    product = store.products.find((p) => p.id === productId);
  }

  if (!product) {
    return { missing: true as const };
  }

  product.landing_copy = input.landingCopy;
  product.docs_markdown = input.docsMarkdown;

  for (const tier of input.tiers) {
    let plan = store.plans.find(
      (p) => p.id === tier.id && p.product_id === productId,
    );
    if (!plan) {
      plan = {
        id: tier.id || crypto.randomUUID(),
        product_id: productId,
        name: tier.name || "Plan",
        price_ngn: tier.price_ngn,
        limit_per_month: tier.limit_per_month,
        features: tier.features,
        monnify_plan_code: null,
        created_at: new Date().toISOString(),
      };
      store.plans.push(plan);
    }
    plan.price_ngn = plan.name === "Pro" ? 15000 : tier.price_ngn;
    plan.limit_per_month = tier.limit_per_month;
    plan.features = tier.features;
  }

  await writeStore(store);
  const plans = store.plans.filter((p) => p.product_id === productId);
  return { missing: false as const, product, plans };
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
