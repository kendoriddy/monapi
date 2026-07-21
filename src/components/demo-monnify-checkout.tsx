"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreditCard, Landmark, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { completePayment, delay } from "@/lib/demo-engine";
import { formatNgn } from "@/lib/utils";

export function DemoMonnifyCheckout() {
  const router = useRouter();
  const params = useSearchParams();
  const ref = params.get("ref") ?? "";
  const amount = Number(params.get("amount") ?? 0);
  const plan = params.get("plan") ?? "Pro";
  const email = params.get("email") ?? "";
  const product = params.get("product") ?? "API Product";

  const [method, setMethod] = useState<"card" | "transfer">("card");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    if (!ref) return;
    setPaying(true);
    setError(null);
    try {
      await delay(700);
      completePayment(ref, window.location.origin);
      router.push(`/success?ref=${encodeURIComponent(ref)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setPaying(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-100">
        Monnify Sandbox (simulated) — filmable demo checkout
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white text-slate-900 shadow-xl">
        <div className="bg-[#1d4ed8] px-6 py-4 text-white">
          <p className="text-xs font-medium uppercase tracking-wider opacity-90">
            Monnify
          </p>
          <p className="mt-1 text-lg font-semibold">Secure checkout</p>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <p className="text-xs text-slate-500">Paying for</p>
            <p className="font-semibold">{product}</p>
            <p className="text-sm text-slate-600">
              {plan} plan · {email}
            </p>
          </div>

          <p className="text-3xl font-bold text-slate-900">
            {formatNgn(amount)}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMethod("card")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                method === "card"
                  ? "border-[#1d4ed8] bg-blue-50 text-[#1d4ed8]"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              <CreditCard className="h-4 w-4" />
              Card
            </button>
            <button
              type="button"
              onClick={() => setMethod("transfer")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                method === "transfer"
                  ? "border-[#1d4ed8] bg-blue-50 text-[#1d4ed8]"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              <Landmark className="h-4 w-4" />
              Bank transfer
            </button>
          </div>

          {method === "card" ? (
            <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              <p>Test card: 5061 0200 0000 0000 012</p>
              <p>Expiry: 05/30 · CVV: 123</p>
            </div>
          ) : (
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              Transfer to Monnify sandbox account — demo completes on Pay.
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <Button
            type="button"
            className="w-full bg-[#1d4ed8] hover:bg-[#1e40af]"
            disabled={paying || !ref}
            onClick={handlePay}
          >
            {paying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : (
              `Pay ${formatNgn(amount)}`
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
