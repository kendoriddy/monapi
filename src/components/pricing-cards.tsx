"use client";

import { Check } from "lucide-react";
import { cn, formatNgn } from "@/lib/utils";
import type { AiPlanTier, SubscriptionPlan } from "@/lib/types";

type PlanLike = Pick<
  SubscriptionPlan | AiPlanTier,
  "name" | "price_ngn" | "limit_per_month" | "features"
> & { id?: string; description?: string };

type Props = {
  plans: PlanLike[];
  selectable?: boolean;
  selectedId?: string | null;
  onSelect?: (plan: PlanLike) => void;
  highlightName?: string;
};

export function PricingCards({
  plans,
  selectable = false,
  selectedId,
  onSelect,
  highlightName = "Pro",
}: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {plans.map((plan) => {
        const featured = plan.name === highlightName;
        const selected = selectedId
          ? selectedId === plan.id || selectedId === plan.name
          : false;

        return (
          <button
            key={plan.id ?? plan.name}
            type="button"
            disabled={!selectable}
            onClick={() => onSelect?.(plan)}
            className={cn(
              "relative flex h-full flex-col rounded-2xl border p-6 text-left transition",
              featured
                ? "border-[var(--accent)] bg-[var(--surface-2)] shadow-[0_0_0_1px_var(--accent)]"
                : "border-[var(--border)] bg-[var(--surface)]",
              selectable && "cursor-pointer hover:border-[var(--accent)]/70",
              selected && "ring-2 ring-[var(--accent)]",
              !selectable && "cursor-default",
            )}
          >
            {featured && (
              <span className="absolute -top-3 left-6 rounded-md bg-[var(--accent)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--accent-fg)]">
                Recommended
              </span>
            )}
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-[var(--foreground)]">
                {plan.name}
              </h3>
              <p className="mt-2 text-3xl font-bold tracking-tight text-[var(--foreground)]">
                {plan.price_ngn === 0 ? "Free" : formatNgn(Number(plan.price_ngn))}
                {plan.price_ngn > 0 && (
                  <span className="ml-1 text-sm font-normal text-[var(--muted)]">
                    /mo
                  </span>
                )}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {plan.limit_per_month.toLocaleString()} requests / month
              </p>
            </div>
            {plan.description && (
              <p className="mb-4 text-sm text-[var(--muted)]">{plan.description}</p>
            )}
            <ul className="mt-auto space-y-2.5">
              {(plan.features ?? []).map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2 text-sm text-[var(--foreground)]"
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </button>
        );
      })}
    </div>
  );
}
