"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Copy, Loader2, Mail, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  clearDemoPendingCheckout,
  getDemoPendingCheckout,
} from "@/lib/demo-client-store";
import { runtimeFetchHeaders } from "@/lib/runtime-client";
import type { EmailPreview } from "@/lib/types";

type SubscriptionPayload = {
  apiKey: string;
  customerEmail: string;
  status: string;
  productName: string;
  planName: string;
  productSlug: string;
  gatewayUrl: string;
  curlSnippet: string;
  emailPreview: EmailPreview | null;
};

export function SuccessPanel({
  paymentRef,
  demoMode = false,
}: {
  paymentRef: string;
  demoMode?: boolean;
}) {
  const [data, setData] = useState<SubscriptionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"key" | "curl" | null>(null);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    async function tryReconcile() {
      try {
        const demoPending = demoMode
          ? getDemoPendingCheckout(paymentRef)
          : null;
        const res = await fetch("/api/checkout/reconcile", {
          method: "POST",
          headers: runtimeFetchHeaders(demoMode, {
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            ref: paymentRef,
            demoPending: demoPending
              ? {
                  planId: demoPending.planId,
                  productId: demoPending.productId,
                  customerEmail: demoPending.customerEmail,
                  customerName: demoPending.customerName,
                  amount: demoPending.amount,
                  productName: demoPending.productName,
                  planName: demoPending.planName,
                  productSlug: demoPending.productSlug,
                }
              : null,
          }),
        });
        return res.ok;
      } catch {
        return false;
      }
    }

    async function poll() {
      attempts += 1;
      try {
        // Reconcile early and keep retrying — Monnify redirect often lands
        // before the webhook, and Demo pending may only exist in localStorage.
        if (
          attempts === 1 ||
          attempts === 3 ||
          attempts === 6 ||
          attempts === 12
        ) {
          await tryReconcile();
        }

        const res = await fetch(
          `/api/subscriptions/by-ref?ref=${encodeURIComponent(paymentRef)}`,
          { headers: runtimeFetchHeaders(demoMode) },
        );
        const json = await res.json();
        if (cancelled) return;

        if (json.ready && json.subscription) {
          if (demoMode) clearDemoPendingCheckout(paymentRef);
          setData(json.subscription as SubscriptionPayload);
          return;
        }

        if (attempts < 30) {
          setTimeout(poll, 700);
        } else {
          setError(
            "Still waiting for provisioning. Tap “Verify payment” below, or refresh once.",
          );
        }
      } catch {
        if (!cancelled) {
          if (attempts < 30) setTimeout(poll, 1000);
          else setError("Failed to load subscription");
        }
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [paymentRef, demoMode]);

  async function verifyNow() {
    setError(null);
    setRunning(true);
    try {
      const demoPending = demoMode ? getDemoPendingCheckout(paymentRef) : null;
      await fetch("/api/checkout/reconcile", {
        method: "POST",
        headers: runtimeFetchHeaders(demoMode, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          ref: paymentRef,
          demoPending: demoPending
            ? {
                planId: demoPending.planId,
                productId: demoPending.productId,
                customerEmail: demoPending.customerEmail,
                customerName: demoPending.customerName,
                amount: demoPending.amount,
                productName: demoPending.productName,
                planName: demoPending.planName,
                productSlug: demoPending.productSlug,
              }
            : null,
        }),
      });
      const res = await fetch(
        `/api/subscriptions/by-ref?ref=${encodeURIComponent(paymentRef)}`,
        { headers: runtimeFetchHeaders(demoMode) },
      );
      const json = await res.json();
      if (json.ready && json.subscription) {
        if (demoMode) clearDemoPendingCheckout(paymentRef);
        setData(json.subscription as SubscriptionPayload);
        setError(null);
      } else {
        setError(
          "Payment not provisioned yet. Wait a few seconds and try Verify again.",
        );
      }
    } catch {
      setError("Verification failed. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  async function copy(text: string, kind: "key" | "curl") {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1600);
  }

  async function runRequest() {
    if (!data) return;
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch(data.gatewayUrl, {
        headers: { Authorization: `Bearer ${data.apiKey}` },
      });
      const json = await res.json();
      setRunResult(JSON.stringify(json, null, 2));
    } catch (err) {
      setRunResult(err instanceof Error ? err.message : "Request failed");
    } finally {
      setRunning(false);
    }
  }

  if (error && !data) {
    return (
      <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="text-sm text-[var(--muted)]">{error}</p>
        <Button type="button" onClick={verifyNow} disabled={running}>
          {running ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying…
            </>
          ) : (
            "Verify payment"
          )}
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
        Waiting for Monnify webhook / provisioning…
      </div>
    );
  }

  return (
    <div className="animate-in space-y-6">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 text-[var(--accent)]" />
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--foreground)]">
              You&apos;re in — {data.productName}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {data.planName} · {data.customerEmail}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            API key
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 break-all rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-xs">
              {data.apiKey}
            </code>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => copy(data.apiKey, "key")}
            >
              <Copy className="h-3.5 w-3.5" />
              {copied === "key" ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="mb-3 flex items-center gap-2">
          <Mail className="h-4 w-4 text-[var(--accent)]" />
          <h2 className="font-semibold">Inbox preview</h2>
        </div>
        {data.emailPreview ? (
          <div
            className="prose prose-invert max-w-none rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 text-sm"
            dangerouslySetInnerHTML={{ __html: data.emailPreview.html }}
          />
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Email preview unavailable (Resend not configured).
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="font-semibold">Quick start</h2>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 font-mono text-xs">
          {data.curlSnippet}
        </pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => copy(data.curlSnippet, "curl")}
          >
            <Copy className="h-3.5 w-3.5" />
            {copied === "curl" ? "Copied" : "Copy curl"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={runRequest}
            disabled={running}
          >
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Run test request
          </Button>
        </div>
        {runResult ? (
          <pre className="mt-3 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 font-mono text-xs">
            {runResult}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
