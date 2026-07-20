import { NextResponse } from "next/server";
import {
  extractMonnifyPaymentStatus,
  isMonnifyConfigured,
  verifyMonnifySignature,
} from "@/lib/monnify";
import { getAppOrigin } from "@/lib/origin";
import { provisionFromPaymentReference } from "@/lib/provision";

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

    const origin = getAppOrigin(request);
    const result = await provisionFromPaymentReference({
      paymentReference: payment.paymentReference,
      customerEmail: payment.customerEmail || undefined,
      customerName: payment.customerName || undefined,
      origin,
    });

    if ("missingPending" in result && result.missingPending) {
      console.info("[webhook/monnify] no pending checkout", {
        paymentReference: payment.paymentReference,
      });
      return NextResponse.json({ ok: true, alreadyProcessed: true });
    }

    console.info("[webhook/monnify] provisioned API key", {
      paymentReference: payment.paymentReference,
      transactionReference: payment.transactionReference,
      keyPrefix: `${result.apiKey.slice(0, 12)}…`,
      alreadyProcessed: result.alreadyProcessed,
    });

    return NextResponse.json({
      ok: true,
      provisioned: !result.alreadyProcessed,
      alreadyProcessed: result.alreadyProcessed,
      paymentReference: payment.paymentReference,
      apiKey: result.apiKey,
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
