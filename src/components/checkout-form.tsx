"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PricingCards } from "@/components/pricing-cards";
import {
  persistDemoPendingCheckout,
  type DemoPendingCheckout,
} from "@/lib/demo-client-store";
import { runtimeFetchHeaders } from "@/lib/runtime-client";
import type { SubscriptionPlan } from "@/lib/types";

type Props = {
  productId: string;
  productName: string;
  plans: SubscriptionPlan[];
  demoMode?: boolean;
};

export function CheckoutForm({
  productId,
  productName,
  plans,
  demoMode = false,
}: Props) {
  const [selectedPlanId, setSelectedPlanId] = useState(
    plans.find((p) => p.name === "Pro")?.id ?? plans[0]?.id ?? "",
  );
  const [customerName, setCustomerName] = useState("Ada Lovelace");
  const [customerEmail, setCustomerEmail] = useState("customer@example.com");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlanId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout/initialize", {
        method: "POST",
        headers: runtimeFetchHeaders(demoMode, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          productId,
          planId: selectedPlanId,
          customerName,
          customerEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");

      if (demoMode && data.pendingCheckout) {
        persistDemoPendingCheckout(data.pendingCheckout as DemoPendingCheckout);
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl as string;
        return;
      }

      // Demo / free-tier path: webhook already simulated or free plan provisioned
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl as string;
        return;
      }

      throw new Error("No checkout URL returned");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubscribe} className="space-y-8">
      <div>
        <p className="mb-3 text-sm text-[var(--muted)]">
          Choose a plan for{" "}
          <span className="text-[var(--foreground)]">{productName}</span>
        </p>
        <PricingCards
          plans={plans}
          selectable
          selectedId={selectedPlanId}
          onSelect={(plan) => {
            if (plan.id) setSelectedPlanId(plan.id);
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="customerName">Full name</Label>
          <Input
            id="customerName"
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="customerEmail">Email</Label>
          <Input
            id="customerEmail"
            required
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={loading || !selectedPlanId}
        className="w-full sm:w-auto"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Opening Monnify…
          </>
        ) : (
          "Subscribe"
        )}
      </Button>
    </form>
  );
}
