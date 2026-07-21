/**
 * Client-only Demo Engine — zero network.
 * All Demo mode state lives in localStorage. Never call /api/* from here.
 */

import {
  AFRICAN_LOCATION_PLAN_IDS,
  AFRICAN_LOCATION_PRODUCT_ID,
  AFRICAN_LOCATION_SLUG,
  buildAfricanLocationSeed,
  buildApiKeyEmailHtml,
  buildDemoBlueprint,
  mockGatewayResponse,
} from "@/lib/demo-blueprint";
import type {
  ApiProduct,
  CustomerSubscription,
  EmailPreview,
  SubscriptionPlan,
} from "@/lib/types";
import {
  buildGatewayCurl,
  generateApiKey,
  generatePaymentReference,
  gatewayUrl,
  slugifyProductName,
} from "@/lib/utils";

/** Bumped when the seeded demo product changes (clears stale PlateReader catalogs). */
export const DEMO_CATALOG_KEY = "monapi.demo.engine.v2";

export type DemoPendingCheckout = {
  paymentReference: string;
  planId: string;
  productId: string;
  customerEmail: string;
  customerName: string;
  amount: number;
  createdAt: string;
  productName: string;
  planName: string;
  productSlug: string;
};

export type DemoCatalog = {
  products: ApiProduct[];
  plans: SubscriptionPlan[];
  subscriptions: CustomerSubscription[];
  pendingCheckouts: DemoPendingCheckout[];
};

export type DemoSubscriptionPayload = {
  apiKey: string;
  customerEmail: string;
  status: string;
  productName: string;
  planName: string;
  productSlug: string;
  gatewayUrl: string;
  curlSnippet: string;
  emailPreview: EmailPreview | null;
};

export type EditableTierInput = {
  id: string;
  name: string;
  price_ngn: number;
  limit_per_month: number;
  features: string[];
  description?: string;
};

function emptyCatalog(): DemoCatalog {
  return {
    products: [],
    plans: [],
    subscriptions: [],
    pendingCheckouts: [],
  };
}

function newId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getCatalog(): DemoCatalog {
  if (typeof window === "undefined") return emptyCatalog();
  try {
    const raw = window.localStorage.getItem(DEMO_CATALOG_KEY);
    if (!raw) return emptyCatalog();
    const parsed = JSON.parse(raw) as Partial<DemoCatalog>;
    return {
      products: parsed.products ?? [],
      plans: parsed.plans ?? [],
      subscriptions: parsed.subscriptions ?? [],
      pendingCheckouts: parsed.pendingCheckouts ?? [],
    };
  } catch {
    return emptyCatalog();
  }
}

export function saveCatalog(catalog: DemoCatalog) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_CATALOG_KEY, JSON.stringify(catalog));
}

/** Ensure African Location API is always available for Subscriber demos. */
export function seedCatalogIfEmpty(): DemoCatalog {
  const catalog = getCatalog();
  const hasSeed = catalog.products.some(
    (p) =>
      p.id === AFRICAN_LOCATION_PRODUCT_ID || p.slug === AFRICAN_LOCATION_SLUG,
  );
  if (hasSeed) return catalog;

  const { product, plans } = buildAfricanLocationSeed();
  catalog.products = [product, ...catalog.products];
  catalog.plans = [
    ...plans,
    ...catalog.plans.filter((p) => p.product_id !== product.id),
  ];
  saveCatalog(catalog);
  return catalog;
}

export function delay(ms = 550): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Generate a hub from form input — canned blueprint, no AI/API. */
export function buildHubFromForm(input: {
  name: string;
  targetUrl: string;
  description: string;
}): {
  product: ApiProduct;
  plans: SubscriptionPlan[];
  blueprint: ReturnType<typeof buildDemoBlueprint>;
} {
  const blueprint = buildDemoBlueprint(input);
  const now = new Date().toISOString();
  const slug = slugifyProductName(blueprint.product_name);
  // Reuse seeded IDs so publish + marketplace stay consistent.
  const isSeedProduct = slug === AFRICAN_LOCATION_SLUG;
  const productId = isSeedProduct
    ? AFRICAN_LOCATION_PRODUCT_ID
    : newId("demo-product");
  const planIdFor = (tierName: string) => {
    if (!isSeedProduct) return newId("demo-plan");
    if (tierName === "Starter") return AFRICAN_LOCATION_PLAN_IDS.starter;
    if (tierName === "Pro") return AFRICAN_LOCATION_PLAN_IDS.pro;
    if (tierName === "Enterprise") return AFRICAN_LOCATION_PLAN_IDS.enterprise;
    return newId("demo-plan");
  };
  const product: ApiProduct = {
    id: productId,
    developer_id: "demo-developer",
    name: blueprint.product_name,
    target_url: input.targetUrl,
    description: input.description,
    landing_copy: blueprint.landing_copy,
    slug,
    docs_markdown: blueprint.docs_markdown,
    // Keep the seed product browsable for Subscriber while developer edits.
    is_live: isSeedProduct ? true : false,
    created_at: now,
  };
  const plans: SubscriptionPlan[] = blueprint.tiers.map((tier) => ({
    id: planIdFor(tier.name),
    product_id: productId,
    name: tier.name,
    price_ngn: tier.name === "Pro" ? 15000 : tier.price_ngn,
    limit_per_month: tier.limit_per_month,
    features: tier.features,
    monnify_plan_code: null,
    created_at: now,
  }));

  const catalog = getCatalog();
  catalog.products = [
    product,
    ...catalog.products.filter(
      (p) => p.id !== product.id && p.slug !== product.slug,
    ),
  ];
  catalog.plans = [
    ...plans,
    ...catalog.plans.filter((p) => p.product_id !== product.id),
  ];
  saveCatalog(catalog);

  return { product, plans, blueprint };
}

/** Persist edited hub and mark live. */
export function publishProduct(snapshot: {
  product: ApiProduct;
  plans: SubscriptionPlan[];
  landingCopy: string;
  docsMarkdown: string;
  productTitle: string;
  productSlug: string;
  tiers: EditableTierInput[];
}): { product: ApiProduct; plans: SubscriptionPlan[] } {
  const now = new Date().toISOString();
  const product: ApiProduct = {
    ...snapshot.product,
    name: snapshot.productTitle || snapshot.product.name,
    slug: snapshot.productSlug || snapshot.product.slug,
    landing_copy: snapshot.landingCopy,
    docs_markdown: snapshot.docsMarkdown,
    is_live: true,
  };
  const plans: SubscriptionPlan[] = snapshot.tiers.map((tier) => ({
    id: tier.id,
    product_id: product.id,
    name: tier.name,
    price_ngn: tier.name === "Pro" ? 15000 : tier.price_ngn,
    limit_per_month: tier.limit_per_month,
    features: tier.features,
    monnify_plan_code: null,
    created_at: now,
  }));

  const catalog = getCatalog();
  catalog.products = [
    product,
    ...catalog.products.filter(
      (p) => p.id !== product.id && p.slug !== product.slug,
    ),
  ];
  catalog.plans = [
    ...plans,
    ...catalog.plans.filter((p) => p.product_id !== product.id),
  ];
  saveCatalog(catalog);
  return { product, plans };
}

/** Update landing copy / docs on an already-live demo product. */
export function updateProductContent(input: {
  productId: string;
  landingCopy: string;
  docsMarkdown: string;
}): ApiProduct | null {
  const catalog = getCatalog();
  const existing = catalog.products.find((p) => p.id === input.productId);
  if (!existing) return null;
  const product: ApiProduct = {
    ...existing,
    landing_copy: input.landingCopy,
    docs_markdown: input.docsMarkdown,
  };
  catalog.products = [
    product,
    ...catalog.products.filter((p) => p.id !== product.id),
  ];
  saveCatalog(catalog);
  return product;
}

export function getProductBySlug(slug: string): {
  product: ApiProduct;
  plans: SubscriptionPlan[];
} | null {
  seedCatalogIfEmpty();
  const catalog = getCatalog();
  const product =
    catalog.products.find((p) => p.slug === slug && p.is_live) ?? null;
  if (!product) return null;
  const plans = catalog.plans
    .filter((p) => p.product_id === product.id)
    .sort((a, b) => a.price_ngn - b.price_ngn);
  return { product, plans };
}

export function getProductById(productId: string): {
  product: ApiProduct;
  plans: SubscriptionPlan[];
} | null {
  seedCatalogIfEmpty();
  const catalog = getCatalog();
  const product = catalog.products.find((p) => p.id === productId) ?? null;
  if (!product) return null;
  const plans = catalog.plans
    .filter((p) => p.product_id === product.id)
    .sort((a, b) => a.price_ngn - b.price_ngn);
  return { product, plans };
}

export function listLiveProducts(): {
  product: ApiProduct;
  plans: SubscriptionPlan[];
}[] {
  seedCatalogIfEmpty();
  const catalog = getCatalog();
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

export function getSubscriptionsForProduct(
  productId: string,
): (CustomerSubscription & {
  plan: SubscriptionPlan | undefined;
})[] {
  const catalog = getCatalog();
  const plans = catalog.plans.filter((p) => p.product_id === productId);
  const planIds = new Set(plans.map((p) => p.id));
  return catalog.subscriptions
    .filter((s) => planIds.has(s.plan_id))
    .map((s) => ({
      ...s,
      plan: plans.find((p) => p.id === s.plan_id),
    }));
}

function provisionSubscription(input: {
  paymentReference: string;
  plan: SubscriptionPlan;
  product: ApiProduct;
  customerEmail: string;
  customerName: string;
  origin: string;
}): DemoSubscriptionPayload {
  const apiKey = generateApiKey();
  const examplePath =
    input.product.slug === AFRICAN_LOCATION_SLUG ? "states" : "";
  const curlSnippet = buildGatewayCurl(
    input.origin,
    input.product.slug,
    apiKey,
    examplePath,
  );
  const emailPreview: EmailPreview = {
    to: input.customerEmail,
    subject: `Your ${input.product.name} API key is ready`,
    html: buildApiKeyEmailHtml({
      customerName: input.customerName,
      productName: input.product.name,
      planName: input.plan.name,
      apiKey,
      curlSnippet,
    }),
    sent: false,
  };

  const subscription: CustomerSubscription = {
    id: newId("demo-sub"),
    plan_id: input.plan.id,
    customer_email: input.customerEmail,
    customer_name: input.customerName,
    api_key: apiKey,
    status: "active",
    monnify_transaction_reference: input.paymentReference,
    requests_this_month: 0,
    usage_reset_at: null,
    email_preview: emailPreview,
    created_at: new Date().toISOString(),
  };

  const catalog = getCatalog();
  catalog.subscriptions = [
    subscription,
    ...catalog.subscriptions.filter(
      (s) => s.monnify_transaction_reference !== input.paymentReference,
    ),
  ];
  catalog.pendingCheckouts = catalog.pendingCheckouts.filter(
    (p) => p.paymentReference !== input.paymentReference,
  );
  saveCatalog(catalog);

  return {
    apiKey,
    customerEmail: input.customerEmail,
    status: "active",
    productName: input.product.name,
    planName: input.plan.name,
    productSlug: input.product.slug,
    gatewayUrl: gatewayUrl(input.origin, input.product.slug),
    curlSnippet,
    emailPreview,
  };
}

/**
 * Start checkout locally.
 * Free → provision immediately + /success
 * Paid → pending + /checkout/demo
 */
export function startCheckout(input: {
  productId: string;
  planId: string;
  customerName: string;
  customerEmail: string;
  origin?: string;
}): { redirectUrl: string } {
  const catalog = seedCatalogIfEmpty();
  const product = catalog.products.find((p) => p.id === input.productId);
  const plan = catalog.plans.find(
    (p) => p.id === input.planId && p.product_id === input.productId,
  );
  if (!product || !plan) {
    throw new Error("Product or plan not found in demo catalog");
  }

  const origin =
    input.origin ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const paymentReference = generatePaymentReference();

  if (plan.price_ngn <= 0) {
    provisionSubscription({
      paymentReference,
      plan,
      product,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      origin,
    });
    return {
      redirectUrl: `/success?ref=${encodeURIComponent(paymentReference)}`,
    };
  }

  const pending: DemoPendingCheckout = {
    paymentReference,
    planId: plan.id,
    productId: product.id,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    amount: plan.price_ngn,
    createdAt: new Date().toISOString(),
    productName: product.name,
    planName: plan.name,
    productSlug: product.slug,
  };

  catalog.pendingCheckouts = [
    pending,
    ...catalog.pendingCheckouts.filter(
      (p) => p.paymentReference !== paymentReference,
    ),
  ];
  saveCatalog(catalog);

  const qs = new URLSearchParams({
    ref: paymentReference,
    amount: String(plan.price_ngn),
    plan: plan.name,
    email: input.customerEmail,
    name: input.customerName,
    product: product.name,
  });
  return { redirectUrl: `/checkout/demo?${qs.toString()}` };
}

/** Complete simulated Monnify payment — provision before navigating. */
export function completePayment(
  paymentReference: string,
  origin?: string,
): DemoSubscriptionPayload {
  const catalog = getCatalog();
  const pending = catalog.pendingCheckouts.find(
    (p) => p.paymentReference === paymentReference,
  );
  if (!pending) {
    // Already provisioned (e.g. free tier or double-submit)
    const existing = getSubscriptionByRef(paymentReference, origin);
    if (existing) return existing;
    throw new Error("Pending checkout not found");
  }

  const product = catalog.products.find((p) => p.id === pending.productId);
  const plan = catalog.plans.find((p) => p.id === pending.planId);
  if (!product || !plan) {
    throw new Error("Product or plan missing for pending checkout");
  }

  const resolvedOrigin =
    origin || (typeof window !== "undefined" ? window.location.origin : "");

  return provisionSubscription({
    paymentReference,
    plan,
    product,
    customerEmail: pending.customerEmail,
    customerName: pending.customerName,
    origin: resolvedOrigin,
  });
}

export function getSubscriptionByRef(
  paymentReference: string,
  origin?: string,
): DemoSubscriptionPayload | null {
  const catalog = getCatalog();
  const subscription = catalog.subscriptions.find(
    (s) => s.monnify_transaction_reference === paymentReference,
  );
  if (!subscription) return null;

  const plan = catalog.plans.find((p) => p.id === subscription.plan_id);
  const product = plan
    ? catalog.products.find((p) => p.id === plan.product_id)
    : null;
  if (!plan || !product) return null;

  const resolvedOrigin =
    origin || (typeof window !== "undefined" ? window.location.origin : "");
  const examplePath = product.slug === AFRICAN_LOCATION_SLUG ? "states" : "";
  const gw = gatewayUrl(resolvedOrigin, product.slug, examplePath);
  const curl = buildGatewayCurl(
    resolvedOrigin,
    product.slug,
    subscription.api_key,
    examplePath,
  );

  return {
    apiKey: subscription.api_key,
    customerEmail: subscription.customer_email,
    status: subscription.status,
    productName: product.name,
    planName: plan.name,
    productSlug: product.slug,
    gatewayUrl: gw,
    curlSnippet: curl,
    emailPreview: subscription.email_preview,
  };
}

export { mockGatewayResponse };
