import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  attachDemoStoreCookie,
  demoUpdateProductHub,
  getDemoStoreSnapshot,
  isDemoMode,
} from "@/lib/demo-store";
import { createClient } from "@/lib/supabase/server";
import type { ApiProduct, SubscriptionPlan } from "@/lib/types";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ productId: string }> },
) {
  try {
    const { productId } = await context.params;
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      landingCopy?: string;
      docsMarkdown?: string;
      tiers?: {
        id: string;
        price_ngn: number;
        limit_per_month: number;
        features: string[];
        description?: string;
      }[];
      demoSnapshot?: {
        product: ApiProduct;
        plans: SubscriptionPlan[];
      } | null;
    };

    if (!body.landingCopy || !body.docsMarkdown || !body.tiers?.length) {
      return NextResponse.json(
        { error: "landingCopy, docsMarkdown, and tiers are required" },
        { status: 400 },
      );
    }

    const tiers = body.tiers.map((tier) => ({
      ...tier,
      features: tier.features.filter(Boolean),
    }));

    if (await isDemoMode(request)) {
      const updated = await demoUpdateProductHub(productId, {
        landingCopy: body.landingCopy,
        docsMarkdown: body.docsMarkdown,
        tiers,
        snapshot: body.demoSnapshot,
      });
      if (updated.missing) {
        return NextResponse.json(
          {
            error:
              "Demo product not found in server store. Regenerate the hub, then publish again.",
          },
          { status: 404 },
        );
      }
      const response = NextResponse.json({
        product: updated.product,
        plans: updated.plans,
        mode: "demo",
      });
      attachDemoStoreCookie(response, await getDemoStoreSnapshot());
      return response;
    }

    const supabase = await createClient();

    const { data: product, error: productError } = await supabase
      .from("api_products")
      .update({
        landing_copy: body.landingCopy,
        docs_markdown: body.docsMarkdown,
      })
      .eq("id", productId)
      .eq("developer_id", user.id)
      .select()
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    for (const tier of tiers) {
      const { data: planRow } = await supabase
        .from("subscription_plans")
        .select("name")
        .eq("id", tier.id)
        .eq("product_id", productId)
        .single();

      const price = planRow?.name === "Pro" ? 15000 : Number(tier.price_ngn);

      await supabase
        .from("subscription_plans")
        .update({
          price_ngn: price,
          limit_per_month: tier.limit_per_month,
          features: tier.features,
        })
        .eq("id", tier.id)
        .eq("product_id", productId);
    }

    const { data: plans } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("product_id", productId)
      .order("price_ngn", { ascending: true });

    return NextResponse.json({ product, plans });
  } catch (error) {
    console.error("[products PATCH]", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 },
    );
  }
}
