import { NextResponse } from "next/server";
import { generateMonetizationPlans } from "@/lib/ai";
import { getCurrentUser } from "@/lib/auth";
import { demoCreateProduct, isDemoMode } from "@/lib/demo-store";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { slugifyProductName, uniqueSlug } from "@/lib/utils";

async function resolveUniqueSlug(
  name: string,
  demo: boolean,
  excludeProductId?: string,
): Promise<string> {
  const base = slugifyProductName(name);
  if (demo) {
    const { demoListDeveloperProducts } = await import("@/lib/demo-store");
    const products = await demoListDeveloperProducts("demo-developer");
    const taken = new Set(
      products.filter((p) => p.id !== excludeProductId).map((p) => p.slug),
    );
    return uniqueSlug(base, taken);
  }
  const supabase = createServiceClient();
  const { data } = await supabase.from("api_products").select("slug");
  const taken = new Set(
    (data ?? []).map((r) => r.slug as string).filter(Boolean),
  );
  return uniqueSlug(base, taken);
}

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

    const demo = await isDemoMode(request);
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Demo: local store + offline blueprint only — no AI, no Supabase.
    if (demo) {
      const blueprint = await generateMonetizationPlans(
        description,
        targetUrl,
        name,
        { offline: true },
      );
      const slug = await resolveUniqueSlug(
        name || blueprint.product_name,
        true,
      );
      const { product, plans } = await demoCreateProduct({
        developerId: user.id,
        name: name || blueprint.product_name,
        targetUrl,
        description,
        landingCopy: blueprint.landing_copy,
        docsMarkdown: blueprint.docs_markdown,
        slug,
        tiers: blueprint.tiers,
      });

      return NextResponse.json({ product, plans, blueprint, mode: "demo" });
    }

    const blueprint = await generateMonetizationPlans(
      description,
      targetUrl,
      name,
    );
    const slug = await resolveUniqueSlug(name || blueprint.product_name, false);

    const supabase = await createClient();
    const service = createServiceClient();

    // Ensure profile exists for FK api_products.developer_id → profiles.id.
    const { error: profileError } = await service.from("profiles").upsert(
      {
        id: user.id,
        email: user.email,
        full_name: user.fullName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    if (profileError) {
      console.error("[products] profile upsert failed", {
        message: profileError.message,
        userId: user.id,
      });
      return NextResponse.json(
        {
          error: "Failed to create developer profile",
          detail: profileError.message,
        },
        { status: 500 },
      );
    }

    const { data: product, error: productError } = await supabase
      .from("api_products")
      .insert({
        developer_id: user.id,
        name: name || blueprint.product_name,
        target_url: targetUrl,
        description,
        landing_copy: blueprint.landing_copy,
        slug,
        docs_markdown: blueprint.docs_markdown,
        is_live: false,
      })
      .select()
      .single();

    if (productError || !product) {
      console.error("[products] insert failed", {
        message: productError?.message,
        userId: user.id,
      });
      return NextResponse.json(
        {
          error: "Failed to create API product",
          detail: productError?.message,
        },
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
      try {
        await service.from("api_products").delete().eq("id", product.id);
      } catch {
        /* ignore */
      }
      return NextResponse.json(
        { error: "Failed to create subscription plans" },
        { status: 500 },
      );
    }

    return NextResponse.json({ product, plans, blueprint, mode: "live" });
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
