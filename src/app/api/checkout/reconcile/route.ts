import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-store";
import { isMonnifyConfigured, queryMonnifyTransaction } from "@/lib/monnify";
import {
  findSubscriptionByPaymentReference,
  provisionFromPaymentReference,
} from "@/lib/provision";
import { getAppOrigin } from "@/lib/origin";
import { normalizePaymentReference } from "@/lib/utils";

/**
 * Fallback when Monnify webhooks cannot reach localhost.
 * Verifies the payment against Monnify's query API, then provisions.
 * Demo mode never calls Monnify — simulated checkout provisions locally.
 */
export async function POST(request: Request) {
  try {
    if (await isDemoMode(request)) {
      return NextResponse.json({
        ok: true,
        ready: false,
        mode: "demo",
        message: "Demo mode does not reconcile against Monnify",
      });
    }

    const body = (await request.json()) as { ref?: string };
    const paymentReference = normalizePaymentReference(body.ref);

    if (!paymentReference) {
      return NextResponse.json({ error: "ref is required" }, { status: 400 });
    }

    const origin = getAppOrigin(request);

    const existing = await findSubscriptionByPaymentReference(paymentReference);
    if (existing) {
      return NextResponse.json({
        ok: true,
        ready: true,
        alreadyProcessed: true,
        paymentReference,
      });
    }

    if (!isMonnifyConfigured()) {
      return NextResponse.json(
        {
          error:
            "Payment not provisioned yet and Monnify is not configured to verify",
        },
        { status: 404 },
      );
    }

    const txn = await queryMonnifyTransaction(paymentReference);

    if (txn.status !== "PAID") {
      console.info("[reconcile] transaction not PAID yet", {
        paymentReference,
        status: txn.status,
      });
      return NextResponse.json({
        ok: true,
        ready: false,
        status: txn.status,
      });
    }

    const result = await provisionFromPaymentReference({
      paymentReference: txn.paymentReference || paymentReference,
      customerEmail: txn.customerEmail || undefined,
      customerName: txn.customerName || undefined,
      origin,
    });

    if ("missingPending" in result && result.missingPending) {
      return NextResponse.json(
        { error: "No pending checkout for this payment reference" },
        { status: 404 },
      );
    }

    console.info("[reconcile] provisioned after Monnify query", {
      paymentReference,
      keyPrefix: `${result.apiKey.slice(0, 12)}…`,
    });

    return NextResponse.json({
      ok: true,
      ready: true,
      alreadyProcessed: result.alreadyProcessed,
      paymentReference,
    });
  } catch (error) {
    console.error("[reconcile] failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to reconcile payment",
      },
      { status: 502 },
    );
  }
}
