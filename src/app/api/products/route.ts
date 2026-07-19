import { NextResponse } from "next/server";
import { generateMonetizationPlans } from "@/lib/ai";
import { getCurrentUser } from "@/lib/auth";
import {
  demoCreateProduct,
  isDemoMode,
} from "@/lib/demo-store";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      targetUrl?: string;
      description?: string;
    };

    const name = body.name?.trim();
    const targetUrl = body.targetUrl?.trim();
    const description = body.description?.trim();

    if (!name || !targetUrl || !description) {
      return NextResponse.json(
        { error: "name, targetUrl, and description are required" },
        { status: 400 },
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const blueprint = await generateMonetizationPlans(description, targetUrl);

    if (isDemoMode()) {
      const { product, plans } = await demoCreateProduct({
        developerId: user.id,
        name: name || blueprint.product_name,
        targetUrl,
        description,
        landingCopy: blueprint.landing_copy,
        tiers: blueprint.tiers,
      });

      return NextResponse.json({ product, plans, blueprint });
    }

    const supabase = await createClient();

    // Ensure profile exists
    await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      updated_at: new Date().toISOString(),
    });

    const { data: product, error: productError } = await supabase
      .from("api_products")
      .insert({
        developer_id: user.id,
        name: name || blueprint.product_name,
        target_url: targetUrl,
        description,
        landing_copy: blueprint.landing_copy,
        is_live: false,
      })
      .select()
      .single();

    if (productError || !product) {
      console.error("[products] insert failed", {
        message: productError?.message,
      });
      return NextResponse.json(
        { error: "Failed to create API product" },
        { status: 500 },
      );
    }

    const planRows = blueprint.tiers.map((tier) => ({
      product_id: product.id,
      name: tier.name,
      price_ngn: tier.price_ngn,
      limit_per_month: tier.limit_per_month,
      features: tier.features,
    }));

    const { data: plans, error: plansError } = await supabase
      .from("subscription_plans")
      .insert(planRows)
      .select();

    if (plansError) {
      console.error("[products] plans insert failed", {
        message: plansError.message,
      });
      // Cleanup orphan product via service role if needed
      try {
        const service = createServiceClient();
        await service.from("api_products").delete().eq("id", product.id);
      } catch {
        /* ignore */
      }
      return NextResponse.json(
        { error: "Failed to create subscription plans" },
        { status: 500 },
      );
    }

    return NextResponse.json({ product, plans, blueprint });
  } catch (error) {
    console.error("[products] unexpected error", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 },
    );
  }
}
