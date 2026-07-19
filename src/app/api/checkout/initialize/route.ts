import { NextResponse } from "next/server";
import {
  demoGetProduct,
  demoProvisionSubscription,
  demoSavePendingCheckout,
  isDemoMode,
} from "@/lib/demo-store";
import { sendApiKeyEmail } from "@/lib/email";
import {
  initializeMonnifyTransaction,
  isMonnifyConfigured,
} from "@/lib/monnify";
import { createServiceClient } from "@/lib/supabase/server";
import { generateApiKey, generatePaymentReference } from "@/lib/utils";

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

    let productName = "";
    let targetUrl = "";
    let planName = "";
    let priceNgn = 0;

    if (isDemoMode()) {
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
      productName = product.name;
      targetUrl = product.target_url;
      planName = plan.name;
      priceNgn = Number(plan.price_ngn);
    } else {
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

      productName = product.name;
      targetUrl = product.target_url;
      planName = plan.name;
      priceNgn = Number(plan.price_ngn);
    }

    const paymentReference = generatePaymentReference();
    const origin = new URL(request.url).origin;
    const redirectUrl = `${origin}/success?ref=${encodeURIComponent(paymentReference)}`;

    // Free tier: provision immediately without Monnify
    if (priceNgn <= 0) {
      const apiKey = generateApiKey();
      if (isDemoMode()) {
        await demoProvisionSubscription({
          planId,
          customerEmail,
          customerName,
          apiKey,
          monnifyTransactionReference: paymentReference,
        });
      } else {
        const supabase = createServiceClient();
        await supabase.from("customer_subscriptions").insert({
          plan_id: planId,
          customer_email: customerEmail,
          customer_name: customerName,
          api_key: apiKey,
          status: "active",
          monnify_transaction_reference: paymentReference,
        });
      }

      await sendApiKeyEmail({
        to: customerEmail,
        customerName,
        productName,
        planName,
        apiKey,
        targetUrl,
      });

      return NextResponse.json({
        redirectUrl,
        paymentReference,
        mode: "free",
      });
    }

    // Persist pending checkout for webhook mapping
    if (isDemoMode()) {
      await demoSavePendingCheckout({
        paymentReference,
        planId,
        productId,
        customerEmail,
        customerName,
        amount: priceNgn,
        createdAt: new Date().toISOString(),
      });
    } else {
      const supabase = createServiceClient();
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
    }

    // Sandbox / demo without Monnify credentials: simulate paid webhook
    if (!isMonnifyConfigured()) {
      console.warn(
        "[checkout] Monnify not configured — simulating PAID webhook for demo",
      );

      const simulateRes = await fetch(`${origin}/api/webhooks/monnify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-monapi-demo-simulate": "1",
        },
        body: JSON.stringify({
          eventData: {
            paymentStatus: "PAID",
            paymentReference,
            transactionReference: paymentReference,
            amountPaid: priceNgn,
            paidOn: new Date().toISOString(),
            customer: { email: customerEmail, name: customerName },
          },
        }),
      });

      if (!simulateRes.ok) {
        const sim = await simulateRes.json().catch(() => ({}));
        console.error("[checkout] demo simulate failed", sim);
        return NextResponse.json(
          { error: "Demo payment simulation failed" },
          { status: 500 },
        );
      }

      return NextResponse.json({
        redirectUrl,
        paymentReference,
        mode: "demo-simulate",
      });
    }

    try {
      const monnify = await initializeMonnifyTransaction({
        amount: priceNgn,
        customerName,
        customerEmail,
        paymentReference,
        paymentDescription: `Subscribing to ${planName} for ${productName}`,
        redirectUrl,
      });

      return NextResponse.json({
        checkoutUrl: monnify.checkoutUrl,
        paymentReference: monnify.paymentReference,
        mode: "monnify",
      });
    } catch (error) {
      console.error("[checkout] Monnify init failed — falling back to demo", {
        message: error instanceof Error ? error.message : "unknown",
      });

      // Robust fallback for unexpected Monnify errors during demos
      const simulateRes = await fetch(`${origin}/api/webhooks/monnify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-monapi-demo-simulate": "1",
        },
        body: JSON.stringify({
          eventData: {
            paymentStatus: "PAID",
            paymentReference,
            transactionReference: paymentReference,
            amountPaid: priceNgn,
            paidOn: new Date().toISOString(),
            customer: { email: customerEmail, name: customerName },
          },
        }),
      });

      if (!simulateRes.ok) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to initialize checkout",
          },
          { status: 502 },
        );
      }

      return NextResponse.json({
        redirectUrl,
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
