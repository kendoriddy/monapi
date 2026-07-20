import { NextResponse } from "next/server";
import {
  attachDemoStoreCookie,
  getDemoStoreSnapshot,
  isDemoMode,
} from "@/lib/demo-store";
import { isMonnifyConfigured, queryMonnifyTransaction } from "@/lib/monnify";
import {
  findSubscriptionByPaymentReference,
  provisionFromPaymentReference,
  type DemoPendingOverride,
} from "@/lib/provision";
import { getAppOrigin } from "@/lib/origin";
import { normalizePaymentReference } from "@/lib/utils";

const PAID_STATUSES = new Set([
  "PAID",
  "SUCCESS",
  "SUCCESSFUL",
  "COMPLETED",
  "COMPLETE",
]);

/**
 * Fallback when Monnify webhooks cannot reach the server (or demo cookie
 * store isn't visible to webhooks). Verifies payment via Monnify query API,
 * then provisions into demo store or Supabase.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      ref?: string;
      demoPending?: DemoPendingOverride | null;
    };
    const paymentReference = normalizePaymentReference(body.ref);

    if (!paymentReference) {
      return NextResponse.json({ error: "ref is required" }, { status: 400 });
    }

    const origin = getAppOrigin(request);
    const demo = await isDemoMode(request);

    const existing = await findSubscriptionByPaymentReference(
      paymentReference,
      request,
    );
    if (existing) {
      const res = NextResponse.json({
        ok: true,
        ready: true,
        alreadyProcessed: true,
        paymentReference,
      });
      if (demo) attachDemoStoreCookie(res, await getDemoStoreSnapshot());
      return res;
    }

    let paid = false;
    let customerEmail = body.demoPending?.customerEmail;
    let customerName = body.demoPending?.customerName;
    let monnifyRef = paymentReference;
    let monnifyError: string | null = null;

    if (isMonnifyConfigured()) {
      try {
        const txn = await queryMonnifyTransaction(paymentReference);
        const status = txn.status.toUpperCase();
        if (PAID_STATUSES.has(status)) {
          paid = true;
          monnifyRef = txn.paymentReference || paymentReference;
          customerEmail = txn.customerEmail || customerEmail;
          customerName = txn.customerName || customerName;
        } else {
          return NextResponse.json({
            ok: true,
            ready: false,
            status: txn.status,
          });
        }
      } catch (error) {
        monnifyError =
          error instanceof Error
            ? error.message
            : "Failed to verify payment with Monnify";
        console.error("[reconcile] Monnify verify failed", { monnifyError });
      }
    }

    // Demo only: if Monnify verify is broken/misconfigured but the browser
    // still has the pending checkout from init, finish provisioning locally.
    if (!paid && demo && body.demoPending) {
      console.warn(
        "[reconcile] demo fallback provision without Monnify verify",
        { paymentReference, monnifyError },
      );
      paid = true;
    }

    if (!paid) {
      return NextResponse.json(
        {
          error:
            monnifyError ??
            "Payment not provisioned yet and could not be verified with Monnify",
        },
        { status: monnifyError ? 502 : 404 },
      );
    }

    const result = await provisionFromPaymentReference({
      paymentReference: monnifyRef,
      customerEmail,
      customerName,
      origin,
      request,
      demoPending: body.demoPending,
    });

    if ("missingPending" in result && result.missingPending) {
      console.error("[reconcile] missing pending checkout", {
        paymentReference,
        demo,
        hasClientPending: Boolean(body.demoPending),
      });
      return NextResponse.json(
        { error: "No pending checkout for this payment reference" },
        { status: 404 },
      );
    }

    console.info("[reconcile] provisioned", {
      paymentReference,
      keyPrefix: `${result.apiKey.slice(0, 12)}…`,
      demo,
      monnifyVerified: !monnifyError,
    });

    const res = NextResponse.json({
      ok: true,
      ready: true,
      alreadyProcessed: result.alreadyProcessed,
      paymentReference,
      demoFallback: Boolean(demo && monnifyError),
    });
    if (demo) attachDemoStoreCookie(res, await getDemoStoreSnapshot());
    return res;
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
