import {
  demoGetProductBySlug,
  demoGetSubscriptionByApiKey,
  demoIncrementUsage,
  isDemoMode,
} from "@/lib/demo-store";
import { createServiceClient } from "@/lib/supabase/server";
import type { ApiProduct, SubscriptionPlan } from "@/lib/types";

type GatewayContext = {
  product: ApiProduct;
  plan: SubscriptionPlan;
  subscriptionId: string;
  apiKey: string;
};

function startOfUtcMonth() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function mockResponse(product: ApiProduct, path: string) {
  const isOcr =
    product.name.toLowerCase().includes("ocr") ||
    product.name.toLowerCase().includes("plate");
  return {
    ok: true,
    monapi: true,
    product: product.slug,
    path: path || "/",
    mock: isOcr
      ? {
          plate: "ABC-123-XY",
          confidence: 0.97,
          region: "NG",
          message: "License plate detected (Monapi demo gateway)",
        }
      : {
          message: "Request authorized via Monapi gateway",
          timestamp: new Date().toISOString(),
        },
  };
}

async function resolveContext(
  slug: string,
  apiKey: string,
): Promise<
  | { ok: true; ctx: GatewayContext; requests: number; limit: number }
  | { ok: false; status: number; body: Record<string, unknown> }
> {
  if (await isDemoMode()) {
    const { product } = await demoGetProductBySlug(slug);
    if (!product) {
      return {
        ok: false,
        status: 404,
        body: { error: "Product not found" },
      };
    }
    const match = await demoGetSubscriptionByApiKey(apiKey);
    if (!match?.plan || match.product?.id !== product.id) {
      return {
        ok: false,
        status: 401,
        body: { error: "Invalid or missing API key" },
      };
    }
    const sub = match.subscription;
    const limit = match.plan.limit_per_month;
    const used = sub.requests_this_month ?? 0;
    if (used >= limit) {
      return {
        ok: false,
        status: 429,
        body: {
          error: "Rate limit exceeded",
          limit_per_month: limit,
          requests_this_month: used,
        },
      };
    }
    return {
      ok: true,
      ctx: {
        product,
        plan: match.plan,
        subscriptionId: sub.id,
        apiKey,
      },
      requests: used,
      limit,
    };
  }

  const supabase = createServiceClient();
  const { data: product } = await supabase
    .from("api_products")
    .select("*")
    .eq("slug", slug)
    .eq("is_live", true)
    .single();

  if (!product) {
    return {
      ok: false,
      status: 404,
      body: { error: "Product not found" },
    };
  }

  const { data: sub } = await supabase
    .from("customer_subscriptions")
    .select("*, subscription_plans(*)")
    .eq("api_key", apiKey)
    .eq("status", "active")
    .maybeSingle();

  if (!sub) {
    return {
      ok: false,
      status: 401,
      body: { error: "Invalid or missing API key" },
    };
  }

  const plan = sub.subscription_plans as unknown as SubscriptionPlan;
  if (plan.product_id !== product.id) {
    return {
      ok: false,
      status: 401,
      body: { error: "Invalid or missing API key" },
    };
  }

  const monthStart = startOfUtcMonth();
  let used = Number(sub.requests_this_month ?? 0);
  const resetAt = sub.usage_reset_at
    ? new Date(sub.usage_reset_at as string)
    : null;
  if (!resetAt || resetAt < monthStart) {
    used = 0;
    await supabase
      .from("customer_subscriptions")
      .update({
        requests_this_month: 0,
        usage_reset_at: monthStart.toISOString(),
      })
      .eq("id", sub.id);
  }

  if (used >= plan.limit_per_month) {
    return {
      ok: false,
      status: 429,
      body: {
        error: "Rate limit exceeded",
        limit_per_month: plan.limit_per_month,
        requests_this_month: used,
      },
    };
  }

  return {
    ok: true,
    ctx: {
      product: product as ApiProduct,
      plan,
      subscriptionId: sub.id as string,
      apiKey,
    },
    requests: used,
    limit: plan.limit_per_month,
  };
}

async function incrementUsage(subscriptionId: string) {
  if (await isDemoMode()) {
    await demoIncrementUsage(subscriptionId);
    return;
  }
  const supabase = createServiceClient();
  const { data: sub } = await supabase
    .from("customer_subscriptions")
    .select("requests_this_month")
    .eq("id", subscriptionId)
    .single();
  const next = Number(sub?.requests_this_month ?? 0) + 1;
  await supabase
    .from("customer_subscriptions")
    .update({ requests_this_month: next })
    .eq("id", subscriptionId);
}

async function tryProxy(
  product: ApiProduct,
  method: string,
  path: string,
  request: Request,
) {
  const base = product.target_url.replace(/\/$/, "");
  const suffix = path ? `/${path.replace(/^\//, "")}` : "";
  const url = `${base}${suffix}`;

  const headers = new Headers();
  const auth = request.headers.get("authorization");
  if (auth) headers.set("authorization", auth);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const init: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(8000),
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = await request.text();
  }

  const res = await fetch(url, init);
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json",
    },
  });
}

export async function handleGatewayRequest(
  request: Request,
  slug: string,
  pathSegments: string[] | undefined,
) {
  const auth = request.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  const apiKey = match?.[1]?.trim();

  if (!apiKey) {
    return Response.json(
      { error: "Missing Authorization: Bearer sk_monapi_…" },
      { status: 401 },
    );
  }

  const resolved = await resolveContext(slug, apiKey);
  if (!resolved.ok) {
    return Response.json(resolved.body, { status: resolved.status });
  }

  const path = (pathSegments ?? []).join("/");
  const { ctx } = resolved;

  await incrementUsage(ctx.subscriptionId);

  const forceMock =
    (await isDemoMode()) ||
    process.env.MONAPI_GATEWAY_MOCK === "true" ||
    ctx.product.target_url.includes("example.com") ||
    ctx.product.target_url.includes("platevision.test");

  if (!forceMock) {
    try {
      return await tryProxy(ctx.product, request.method, path, request);
    } catch (error) {
      console.error("[gateway] upstream failed", {
        slug,
        message: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return Response.json(mockResponse(ctx.product, path));
}
