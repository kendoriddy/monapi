import { promises as fs } from "fs";
import path from "path";
import type {
  ApiProduct,
  CustomerSubscription,
  SubscriptionPlan,
} from "@/lib/types";

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

async function ensureStore(): Promise<DemoStore> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return JSON.parse(raw) as DemoStore;
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

export function isDemoMode() {
  return process.env.MONAPI_DEMO_MODE === "true" || !process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export async function demoCreateProduct(input: {
  developerId: string;
  name: string;
  targetUrl: string;
  description: string;
  landingCopy: string;
  tiers: {
    name: string;
    price_ngn: number;
    limit_per_month: number;
    features: string[];
  }[];
}) {
  const store = await ensureStore();
  const product: ApiProduct = {
    id: crypto.randomUUID(),
    developer_id: input.developerId,
    name: input.name,
    target_url: input.targetUrl,
    description: input.description,
    landing_copy: input.landingCopy,
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

export async function demoPublishProduct(productId: string) {
  const store = await ensureStore();
  const product = store.products.find((p) => p.id === productId);
  if (!product) throw new Error("Product not found");
  product.is_live = true;
  await writeStore(store);
  return product;
}

export async function demoListDeveloperProducts(developerId: string) {
  const store = await ensureStore();
  return store.products.filter((p) => p.developer_id === developerId);
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
    store.pendingCheckouts.find((c) => c.paymentReference === paymentReference) ??
    null
  );
}

export async function demoProvisionSubscription(input: {
  planId: string;
  customerEmail: string;
  customerName: string;
  apiKey: string;
  monnifyTransactionReference: string;
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
        s.monnify_transaction_reference === reference ||
        s.id === reference,
    ) ?? null
  );
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
    (s) =>
      s.monnify_transaction_reference === reference || s.id === reference,
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
