import {
  demoGetPendingCheckout,
  demoGetProduct,
  demoGetSubscriptionDetails,
  demoProvisionSubscription,
  isDemoMode,
} from "@/lib/demo-store";
import { sendApiKeyEmail } from "@/lib/email";
import { createServiceClient } from "@/lib/supabase/server";
import { generateApiKey } from "@/lib/utils";

export async function findSubscriptionByPaymentReference(
  paymentReference: string,
  request?: Request,
) {
  if (await isDemoMode(request)) {
    const details = await demoGetSubscriptionDetails(paymentReference);
    if (!details) return null;
    return { apiKey: details.subscription.api_key };
  }

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("customer_subscriptions")
    .select("api_key")
    .eq("monnify_transaction_reference", paymentReference)
    .maybeSingle();

  return data ? { apiKey: data.api_key as string } : null;
}

export type DemoPendingOverride = {
  planId: string;
  productId: string;
  customerEmail: string;
  customerName: string;
  amount?: number;
  productName?: string;
  planName?: string;
  productSlug?: string;
};

/**
 * Shared provisioning used by Monnify webhooks and redirect reconcile.
 * Idempotent on paymentReference.
 */
export async function provisionFromPaymentReference(input: {
  paymentReference: string;
  customerEmail?: string;
  customerName?: string;
  origin: string;
  request?: Request;
  /** Browser-stashed pending checkout (Demo + Monnify redirect). */
  demoPending?: DemoPendingOverride | null;
}) {
  const { paymentReference, origin, request } = input;

  const existing = await findSubscriptionByPaymentReference(
    paymentReference,
    request,
  );
  if (existing) {
    return {
      alreadyProcessed: true as const,
      apiKey: existing.apiKey,
      paymentReference,
    };
  }

  if (await isDemoMode(request)) {
    const stored = await demoGetPendingCheckout(paymentReference);
    const pending =
      stored ??
      (input.demoPending
        ? {
            paymentReference,
            planId: input.demoPending.planId,
            productId: input.demoPending.productId,
            customerEmail: input.demoPending.customerEmail,
            customerName: input.demoPending.customerName,
            amount: input.demoPending.amount ?? 0,
            createdAt: new Date().toISOString(),
          }
        : null);

    if (!pending) {
      return { missingPending: true as const };
    }

    // If the browser sent pending but the cookie store lost it, re-save first.
    if (!stored && input.demoPending) {
      const { demoSavePendingCheckout } = await import("@/lib/demo-store");
      await demoSavePendingCheckout(pending);
    }

    const customerEmail =
      input.customerEmail ||
      pending.customerEmail ||
      input.demoPending?.customerEmail ||
      "customer@example.com";
    const customerName =
      input.customerName ||
      pending.customerName ||
      input.demoPending?.customerName ||
      "API Customer";

    const { product, plans } = await demoGetProduct(pending.productId);
    const plan = plans.find((p) => p.id === pending.planId);
    const productName =
      product?.name ?? input.demoPending?.productName ?? "API Product";
    const productSlug =
      product?.slug ?? input.demoPending?.productSlug ?? "api-product";
    const planName = plan?.name ?? input.demoPending?.planName ?? "Plan";

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

    const sub = await demoProvisionSubscription({
      planId: pending.planId,
      customerEmail,
      customerName,
      apiKey,
      monnifyTransactionReference: paymentReference,
      emailPreview: emailResult.preview,
    });

    return {
      alreadyProcessed: false as const,
      apiKey: sub.api_key,
      paymentReference,
    };
  }

  const supabase = createServiceClient();

  const { data: pending } = await supabase
    .from("pending_checkouts")
    .select("*")
    .eq("payment_reference", paymentReference)
    .maybeSingle();

  if (!pending) {
    return { missingPending: true as const };
  }

  const customerEmail = input.customerEmail || pending.customer_email;
  const customerName =
    input.customerName || pending.customer_name || "API Customer";

  const { data: product } = await supabase
    .from("api_products")
    .select("name, slug")
    .eq("id", pending.product_id)
    .single();
  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("name")
    .eq("id", pending.plan_id)
    .single();

  const productName = product?.name ?? "API Product";
  const productSlug = (product?.slug as string) ?? "api-product";
  const planName = plan?.name ?? "Plan";
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

  const { data: sub, error } = await supabase
    .from("customer_subscriptions")
    .insert({
      plan_id: pending.plan_id,
      customer_email: customerEmail,
      customer_name: customerName,
      api_key: apiKey,
      status: "active",
      monnify_transaction_reference: paymentReference,
      email_preview: emailResult.preview,
    })
    .select("api_key")
    .single();

  if (error || !sub) {
    console.error("[provision] insert failed", { message: error?.message });
    throw new Error("Failed to provision subscription");
  }

  await supabase
    .from("pending_checkouts")
    .delete()
    .eq("payment_reference", paymentReference);

  return {
    alreadyProcessed: false as const,
    apiKey: sub.api_key as string,
    paymentReference,
  };
}
