import { NextResponse } from "next/server";
import {
  attachDemoStoreCookie,
  demoGetProduct,
  demoProvisionSubscription,
  demoSavePendingCheckout,
  getDemoStoreSnapshot,
  isDemoMode,
} from "@/lib/demo-store";
import { sendApiKeyEmail } from "@/lib/email";
import {
  initializeMonnifyTransaction,
  isMonnifyConfigured,
} from "@/lib/monnify";
import { getAppOrigin } from "@/lib/origin";
import { createServiceClient } from "@/lib/supabase/server";
import { generateApiKey, generatePaymentReference } from "@/lib/utils";

function demoCheckoutUrl(
  origin: string,
  input: {
    ref: string;
    amount: number;
    plan: string;
    email: string;
    name: string;
    product: string;
  },
) {
  const q = new URLSearchParams({
    ref: input.ref,
    amount: String(input.amount),
    plan: input.plan,
    email: input.email,
    name: input.name,
    product: input.product,
  });
  return `${origin}/checkout/demo?${q.toString()}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      productId?: string;
      planId?: string;
      customerName?: string;
      customerEmail?: string;
    };

    const productId = body.productId?.trim();
    const planId = body.planId?.trim();
    const customerName = body.customerName?.trim() || "API Customer";
    const customerEmail = body.customerEmail?.trim();

    if (!productId || !planId || !customerEmail) {
      return NextResponse.json(
        { error: "productId, planId, and customerEmail are required" },
        { status: 400 },
      );
    }

    const demo = await isDemoMode(request);
    const paymentReference = generatePaymentReference();
    const origin = getAppOrigin(request);
    const monnifyRedirectUrl = `${origin}/success`;
    const appRedirectUrl = `${origin}/success?ref=${encodeURIComponent(paymentReference)}`;

    // ── Demo: local catalog (no Supabase). Prefer real Monnify Sandbox UI. ─
    if (demo) {
      const { product, plans } = await demoGetProduct(productId);
      if (!product || !product.is_live) {
        return NextResponse.json(
          { error: "Product not found or not live" },
          { status: 404 },
        );
      }
      const plan = plans.find((p) => p.id === planId);
      if (!plan) {
        return NextResponse.json({ error: "Plan not found" }, { status: 404 });
      }

      const productName = product.name;
      const productSlug = product.slug;
      const planName = plan.name;
      const priceNgn = Number(plan.price_ngn);

      if (priceNgn <= 0) {
        const apiKey = generateApiKey();
        const emailResult = await sendApiKeyEmail({
          to: customerEmail,
          customerName,
          productName,
          planName,
          apiKey,
          productSlug,
          origin,
          offline: true,
        });
        await demoProvisionSubscription({
          planId,
          customerEmail,
          customerName,
          apiKey,
          monnifyTransactionReference: paymentReference,
          emailPreview: emailResult.preview,
        });
        const freeRes = NextResponse.json({
          redirectUrl: appRedirectUrl,
          paymentReference,
          mode: "demo-free",
        });
        attachDemoStoreCookie(freeRes, await getDemoStoreSnapshot());
        return freeRes;
      }

      await demoSavePendingCheckout({
        paymentReference,
        planId,
        productId,
        customerEmail,
        customerName,
        amount: priceNgn,
        createdAt: new Date().toISOString(),
      });
      const store = await getDemoStoreSnapshot();

      // Use Monnify's hosted Sandbox checkout (the real modal) when configured.
      // Our /checkout/demo page is only a filmable fallback.
      if (isMonnifyConfigured()) {
        try {
          const monnify = await initializeMonnifyTransaction({
            amount: priceNgn,
            customerName,
            customerEmail,
            paymentReference,
            paymentDescription: `Subscribing to ${planName} for ${productName}`,
            redirectUrl: monnifyRedirectUrl,
          });
          const monnifyRes = NextResponse.json({
            checkoutUrl: monnify.checkoutUrl,
            paymentReference: monnify.paymentReference,
            mode: "demo-monnify",
            pendingCheckout: {
              paymentReference,
              planId,
              productId,
              customerEmail,
              customerName,
              amount: priceNgn,
              createdAt: new Date().toISOString(),
              productName,
              planName,
              productSlug,
            },
          });
          attachDemoStoreCookie(monnifyRes, store);
          return monnifyRes;
        } catch (error) {
          console.error(
            "[checkout] demo Monnify init failed — simulated checkout fallback",
            {
              message: error instanceof Error ? error.message : "unknown",
            },
          );
        }
      }

      const checkoutRes = NextResponse.json({
        checkoutUrl: demoCheckoutUrl(origin, {
          ref: paymentReference,
          amount: priceNgn,
          plan: planName,
          email: customerEmail,
          name: customerName,
          product: productName,
        }),
        paymentReference,
        mode: "demo-checkout",
        pendingCheckout: {
          paymentReference,
          planId,
          productId,
          customerEmail,
          customerName,
          amount: priceNgn,
          createdAt: new Date().toISOString(),
          productName,
          planName,
          productSlug,
        },
      });
      attachDemoStoreCookie(checkoutRes, store);
      return checkoutRes;
    }

    // ── Live: Supabase + Monnify ────────────────────────────────────
    const supabase = createServiceClient();
    const { data: product } = await supabase
      .from("api_products")
      .select("*")
      .eq("id", productId)
      .eq("is_live", true)
      .single();

    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .eq("product_id", productId)
      .single();

    if (!product || !plan) {
      return NextResponse.json(
        { error: "Product or plan not found" },
        { status: 404 },
      );
    }

    const productName = product.name;
    const productSlug = product.slug as string;
    const planName = plan.name;
    const priceNgn = Number(plan.price_ngn);

    if (priceNgn <= 0) {
      const apiKey = generateApiKey();
      const emailResult = await sendApiKeyEmail({
        to: customerEmail,
        customerName,
        productName,
        planName,
        apiKey,
        productSlug,
        origin,
      });

      await supabase.from("customer_subscriptions").insert({
        plan_id: planId,
        customer_email: customerEmail,
        customer_name: customerName,
        api_key: apiKey,
        status: "active",
        monnify_transaction_reference: paymentReference,
        email_preview: emailResult.preview,
      });

      return NextResponse.json({
        redirectUrl: appRedirectUrl,
        paymentReference,
        mode: "free",
      });
    }

    const { error } = await supabase.from("pending_checkouts").upsert({
      payment_reference: paymentReference,
      plan_id: planId,
      product_id: productId,
      customer_email: customerEmail,
      customer_name: customerName,
      amount: priceNgn,
    });
    if (error) {
      console.error("[checkout] pending insert failed", {
        message: error.message,
      });
      return NextResponse.json(
        { error: "Failed to start checkout" },
        { status: 500 },
      );
    }

    if (!isMonnifyConfigured()) {
      return NextResponse.json({
        checkoutUrl: demoCheckoutUrl(origin, {
          ref: paymentReference,
          amount: priceNgn,
          plan: planName,
          email: customerEmail,
          name: customerName,
          product: productName,
        }),
        paymentReference,
        mode: "demo-checkout",
      });
    }

    try {
      const monnify = await initializeMonnifyTransaction({
        amount: priceNgn,
        customerName,
        customerEmail,
        paymentReference,
        paymentDescription: `Subscribing to ${planName} for ${productName}`,
        redirectUrl: monnifyRedirectUrl,
      });

      return NextResponse.json({
        checkoutUrl: monnify.checkoutUrl,
        paymentReference: monnify.paymentReference,
        mode: "monnify",
      });
    } catch (error) {
      console.error("[checkout] Monnify init failed — demo checkout fallback", {
        message: error instanceof Error ? error.message : "unknown",
      });

      return NextResponse.json({
        checkoutUrl: demoCheckoutUrl(origin, {
          ref: paymentReference,
          amount: priceNgn,
          plan: planName,
          email: customerEmail,
          name: customerName,
          product: productName,
        }),
        paymentReference,
        mode: "monnify-fallback",
      });
    }
  } catch (error) {
    console.error("[checkout] unexpected", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Unexpected checkout error" },
      { status: 500 },
    );
  }
}
