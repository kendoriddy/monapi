import { NextResponse } from "next/server";
import {
  demoGetPendingCheckout,
  demoGetProduct,
  demoProvisionSubscription,
  isDemoMode,
} from "@/lib/demo-store";
import { sendApiKeyEmail } from "@/lib/email";
import {
  extractMonnifyPaymentStatus,
  isMonnifyConfigured,
  verifyMonnifySignature,
} from "@/lib/monnify";
import { createServiceClient } from "@/lib/supabase/server";
import { generateApiKey } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    let payload: Record<string, unknown> = {};

    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      console.error("[webhook/monnify] invalid JSON body");
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const isDemoSimulate =
      request.headers.get("x-monapi-demo-simulate") === "1";

    if (!isDemoSimulate && isMonnifyConfigured()) {
      const headerHash =
        request.headers.get("monnify-signature") ||
        request.headers.get("x-monnify-signature");
      const valid = verifyMonnifySignature(payload, headerHash);
      if (!valid) {
        console.error("[webhook/monnify] signature verification failed");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 },
        );
      }
    } else if (!isDemoSimulate && !isMonnifyConfigured()) {
      console.error(
        "[webhook/monnify] rejecting unsigned webhook without demo flag",
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payment = extractMonnifyPaymentStatus(payload);

    if (payment.status !== "PAID") {
      console.info("[webhook/monnify] ignoring non-PAID status", {
        status: payment.status,
        paymentReference: payment.paymentReference,
      });
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (!payment.paymentReference) {
      console.error("[webhook/monnify] missing paymentReference");
      return NextResponse.json(
        { error: "Missing paymentReference" },
        { status: 400 },
      );
    }

    let planId = "";
    let customerEmail = payment.customerEmail;
    let customerName = payment.customerName || "API Customer";
    let productName = "API Product";
    let planName = "Plan";
    let productSlug = "api-product";
    const origin = new URL(request.url).origin;

    if (isDemoMode()) {
      const pending = await demoGetPendingCheckout(payment.paymentReference);
      if (!pending) {
        console.info(
          "[webhook/monnify] no pending checkout (may already be provisioned)",
          {
            paymentReference: payment.paymentReference,
          },
        );
        return NextResponse.json({ ok: true, alreadyProcessed: true });
      }
      planId = pending.planId;
      customerEmail = customerEmail || pending.customerEmail;
      customerName = customerName || pending.customerName;

      const { product, plans } = await demoGetProduct(pending.productId);
      const plan = plans.find((p) => p.id === planId);
      productName = product?.name ?? productName;
      productSlug = product?.slug ?? productSlug;
      planName = plan?.name ?? planName;
    } else {
      const supabase = createServiceClient();
      const { data: pending } = await supabase
        .from("pending_checkouts")
        .select("*")
        .eq("payment_reference", payment.paymentReference)
        .maybeSingle();

      if (!pending) {
        console.info("[webhook/monnify] no pending checkout", {
          paymentReference: payment.paymentReference,
        });
        return NextResponse.json({ ok: true, alreadyProcessed: true });
      }

      planId = pending.plan_id;
      customerEmail = customerEmail || pending.customer_email;
      customerName = customerName || pending.customer_name || "API Customer";

      const { data: product } = await supabase
        .from("api_products")
        .select("name, slug")
        .eq("id", pending.product_id)
        .single();
      const { data: plan } = await supabase
        .from("subscription_plans")
        .select("name")
        .eq("id", planId)
        .single();

      productName = product?.name ?? productName;
      productSlug = (product?.slug as string) ?? productSlug;
      planName = plan?.name ?? planName;
    }

    if (!customerEmail) {
      console.error("[webhook/monnify] missing customer email");
      return NextResponse.json(
        { error: "Missing customer email" },
        { status: 400 },
      );
    }

    const apiKey = generateApiKey();
    const txnRef = payment.transactionReference || payment.paymentReference;

    const emailResult = await sendApiKeyEmail({
      to: customerEmail,
      customerName,
      productName,
      planName,
      apiKey,
      productSlug,
      origin,
    });

    let provisionedKey = apiKey;

    if (isDemoMode()) {
      const sub = await demoProvisionSubscription({
        planId,
        customerEmail,
        customerName,
        apiKey,
        monnifyTransactionReference: payment.paymentReference,
        emailPreview: emailResult.preview,
      });
      provisionedKey = sub.api_key;
    } else {
      const supabase = createServiceClient();

      const { data: existing } = await supabase
        .from("customer_subscriptions")
        .select("*")
        .eq("monnify_transaction_reference", payment.paymentReference)
        .maybeSingle();

      if (existing) {
        console.info("[webhook/monnify] subscription already exists");
        return NextResponse.json({
          ok: true,
          alreadyProcessed: true,
          subscriptionId: existing.id,
        });
      }

      const { data: sub, error } = await supabase
        .from("customer_subscriptions")
        .insert({
          plan_id: planId,
          customer_email: customerEmail,
          customer_name: customerName,
          api_key: apiKey,
          status: "active",
          monnify_transaction_reference: payment.paymentReference,
          email_preview: emailResult.preview,
        })
        .select()
        .single();

      if (error || !sub) {
        console.error("[webhook/monnify] insert failed", {
          message: error?.message,
        });
        return NextResponse.json(
          { error: "Failed to provision subscription" },
          { status: 500 },
        );
      }

      provisionedKey = sub.api_key;
      await supabase
        .from("pending_checkouts")
        .delete()
        .eq("payment_reference", payment.paymentReference);
    }

    console.info("[webhook/monnify] provisioned API key", {
      paymentReference: payment.paymentReference,
      transactionReference: txnRef,
      customerEmail,
      planId,
      keyPrefix: `${provisionedKey.slice(0, 12)}…`,
    });

    return NextResponse.json({
      ok: true,
      provisioned: true,
      paymentReference: payment.paymentReference,
      apiKey: provisionedKey,
    });
  } catch (error) {
    console.error("[webhook/monnify] unexpected", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
