"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Copy, Loader2, Mail, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    let reconciled = false;

    async function tryReconcile() {
      if (reconciled) return;
      reconciled = true;
      try {
        // Needed for Demo + real Monnify Sandbox (webhooks can't read demo cookies).
        await fetch("/api/checkout/reconcile", {
          method: "POST",
          headers: runtimeFetchHeaders(demoMode, {
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ ref: paymentRef }),
        });
      } catch {
        /* poll will keep trying */
      }
    }

    async function poll() {
      attempts += 1;
      try {
        // After a couple of polls, verify with Monnify if webhook hasn't landed.
        if (attempts === 2 || attempts === 6) {
          await tryReconcile();
        }

        const res = await fetch(
          `/api/subscriptions/by-ref?ref=${encodeURIComponent(paymentRef)}`,
          { headers: runtimeFetchHeaders(demoMode) },
        );
        const json = await res.json();
        if (cancelled) return;

        if (json.ready && json.subscription) {
          setData(json.subscription as SubscriptionPayload);
          return;
        }

        if (attempts < 25) {
          setTimeout(poll, 800);
        } else {
          setError(
            "Still waiting for provisioning. If you paid on Monnify Sandbox, refresh once — we will verify the payment directly.",
          );
        }
      } catch {
        if (!cancelled) {
          if (attempts < 25) setTimeout(poll, 1000);
          else setError("Failed to load subscription");
        }
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [paymentRef, demoMode]);

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
        headers: {
          Authorization: `Bearer ${data.apiKey}`,
          "Content-Type": "application/json",
        },
      });
      const text = await res.text();
      setRunResult(`${res.status} ${res.statusText}\n\n${text}`);
    } catch (err) {
      setRunResult(err instanceof Error ? err.message : "Request failed");
    } finally {
      setRunning(false);
    }
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-[var(--muted)]">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
        Provisioning your API key via webhook…
      </div>
    );
  }

  const preview = data.emailPreview;

  return (
    <div className="animate-in space-y-6">
      <div className="rounded-2xl border border-[var(--accent)]/40 bg-[var(--surface)] p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 text-[var(--accent)]" />
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--foreground)]">
              You&apos;re live
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {data.planName} on {data.productName} · {data.customerEmail}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            API Key
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <code className="flex-1 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-3 font-mono text-sm text-[var(--accent)]">
              {data.apiKey}
            </code>
            <Button
              type="button"
              variant="secondary"
              onClick={() => copy(data.apiKey, "key")}
            >
              <Copy className="h-4 w-4" />
              {copied === "key" ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            Quick start
          </p>
          <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 font-mono text-xs leading-relaxed text-[var(--foreground)]">
            {data.curlSnippet}
          </pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => copy(data.curlSnippet, "curl")}
            >
              <Copy className="h-4 w-4" />
              {copied === "curl" ? "Copied curl" : "Copy curl"}
            </Button>
            <Button type="button" onClick={runRequest} disabled={running}>
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Run request
            </Button>
          </div>
          {runResult && (
            <pre className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 font-mono text-xs text-[var(--foreground)]">
              {runResult}
            </pre>
          )}
        </div>
      </div>

      {preview && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="mb-4 flex items-center gap-2">
            <Mail className="h-5 w-5 text-[var(--accent)]" />
            <div>
              <p className="font-semibold text-[var(--foreground)]">
                {preview.sent ? "Sent via Resend" : "Demo inbox"}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {preview.sent
                  ? "Confirmation email delivered to the customer."
                  : "Resend not configured — showing the email your customer would receive."}
              </p>
            </div>
          </div>
          <p className="text-sm text-[var(--muted)]">
            To: <span className="text-[var(--foreground)]">{preview.to}</span>
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
            {preview.subject}
          </p>
          <div
            className="prose-inbox mt-4 max-h-64 overflow-y-auto rounded-lg border border-[var(--border)] bg-white p-4 text-sm text-slate-800"
            dangerouslySetInnerHTML={{ __html: preview.html }}
          />
        </div>
      )}
    </div>
  );
}
