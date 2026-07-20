import { NextResponse } from "next/server";
import { demoGetSubscriptionDetails, isDemoMode } from "@/lib/demo-store";
import { createServiceClient } from "@/lib/supabase/server";
import { buildGatewayCurl } from "@/lib/utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ref = searchParams.get("ref");

  if (!ref) {
    return NextResponse.json({ error: "ref is required" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;

  try {
    if (isDemoMode()) {
      const details = await demoGetSubscriptionDetails(ref);
      if (!details) {
        return NextResponse.json({ ready: false }, { status: 202 });
      }

      const slug = details.product?.slug ?? "api-product";
      return NextResponse.json({
        ready: true,
        subscription: {
          apiKey: details.subscription.api_key,
          customerEmail: details.subscription.customer_email,
          status: details.subscription.status,
          productName: details.product?.name ?? "API Product",
          planName: details.plan?.name ?? "Plan",
          productSlug: slug,
          gatewayUrl: `${origin}/api/v1/${slug}`,
          curlSnippet: buildGatewayCurl(
            origin,
            slug,
            details.subscription.api_key,
          ),
          emailPreview: details.subscription.email_preview,
        },
      });
    }

    const supabase = createServiceClient();
    const { data: sub } = await supabase
      .from("customer_subscriptions")
      .select(
        "api_key, customer_email, status, email_preview, subscription_plans(name, api_products(name, slug))",
      )
      .eq("monnify_transaction_reference", ref)
      .maybeSingle();

    if (!sub) {
      return NextResponse.json({ ready: false }, { status: 202 });
    }

    const plan = sub.subscription_plans as unknown as {
      name: string;
      api_products: { name: string; slug: string } | null;
    } | null;

    const slug = plan?.api_products?.slug ?? "api-product";

    return NextResponse.json({
      ready: true,
      subscription: {
        apiKey: sub.api_key,
        customerEmail: sub.customer_email,
        status: sub.status,
        productName: plan?.api_products?.name ?? "API Product",
        planName: plan?.name ?? "Plan",
        productSlug: slug,
        gatewayUrl: `${origin}/api/v1/${slug}`,
        curlSnippet: buildGatewayCurl(origin, slug, sub.api_key as string),
        emailPreview: sub.email_preview,
      },
    });
  } catch (error) {
    console.error("[subscriptions/by-ref]", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
