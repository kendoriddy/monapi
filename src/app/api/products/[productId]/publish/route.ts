import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  attachDemoStoreCookie,
  demoGetProduct,
  demoPublishProduct,
  getDemoStoreSnapshot,
  isDemoMode,
} from "@/lib/demo-store";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ productId: string }> },
) {
  try {
    const { productId } = await context.params;
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (await isDemoMode(request)) {
      const product = await demoPublishProduct(productId);
      const { plans } = await demoGetProduct(productId);
      const response = NextResponse.json({
        product,
        plans,
        mode: "demo",
      });
      attachDemoStoreCookie(response, await getDemoStoreSnapshot());
      return response;
    }

    const supabase = await createClient();
    const { data: product, error } = await supabase
      .from("api_products")
      .update({ is_live: true })
      .eq("id", productId)
      .eq("developer_id", user.id)
      .select()
      .single();

    if (error || !product) {
      console.error("[publish] failed", { message: error?.message });
      return NextResponse.json(
        { error: "Failed to publish product" },
        { status: 404 },
      );
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error("[publish] unexpected", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 },
    );
  }
}
