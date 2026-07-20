"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProductDocs } from "@/components/product-docs";
import { formatNgn } from "@/lib/utils";
import type { SubscriptionPlan } from "@/lib/types";

export type EditableTier = {
  id: string;
  name: string;
  price_ngn: number;
  limit_per_month: number;
  features: string[];
  description?: string;
};

type Props = {
  productName: string;
  landingCopy: string;
  onLandingCopyChange: (value: string) => void;
  docsMarkdown: string;
  onDocsMarkdownChange: (value: string) => void;
  tiers: EditableTier[];
  onTierChange: (id: string, patch: Partial<EditableTier>) => void;
  onTierFeaturesChange: (id: string, raw: string) => void;
  publicSlug: string | null;
};

export function HubPreviewEditor({
  productName,
  landingCopy,
  onLandingCopyChange,
  docsMarkdown,
  onDocsMarkdownChange,
  tiers,
  onTierChange,
  onTierFeaturesChange,
  publicSlug,
}: Props) {
  return (
    <div className="space-y-8">
      <div>
        <Label htmlFor="landingCopy">Landing page headline</Label>
        <Textarea
          id="landingCopy"
          value={landingCopy}
          onChange={(e) => onLandingCopyChange(e.target.value)}
          className="mt-1.5 min-h-[80px]"
        />
        {publicSlug && (
          <p className="mt-2 text-xs text-[var(--muted)]">
            Public URL after publish:{" "}
            <code className="text-[var(--accent)]">/p/{publicSlug}</code>
          </p>
        )}
      </div>

      <div>
        <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
          Pricing tiers
        </h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Adjust NGN prices and limits before you publish. Pro stays at ₦15,000
          for demo consistency.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4"
            >
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {tier.name}
              </p>
              <div className="mt-3 grid gap-3">
                <div>
                  <Label htmlFor={`price-${tier.id}`}>Price (NGN / mo)</Label>
                  <Input
                    id={`price-${tier.id}`}
                    type="number"
                    min={0}
                    disabled={tier.name === "Pro"}
                    value={tier.name === "Pro" ? 15000 : tier.price_ngn}
                    onChange={(e) =>
                      onTierChange(tier.id, {
                        price_ngn: Number(e.target.value),
                      })
                    }
                  />
                  {tier.name === "Pro" && (
                    <p className="mt-1 text-[10px] text-[var(--muted)]">
                      Locked for pitch demo ({formatNgn(15000)})
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor={`limit-${tier.id}`}>Requests / month</Label>
                  <Input
                    id={`limit-${tier.id}`}
                    type="number"
                    min={1}
                    value={tier.limit_per_month}
                    onChange={(e) =>
                      onTierChange(tier.id, {
                        limit_per_month: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor={`features-${tier.id}`}>
                    Features (one per line)
                  </Label>
                  <Textarea
                    id={`features-${tier.id}`}
                    className="min-h-[100px] font-mono text-xs"
                    value={tier.features.join("\n")}
                    onChange={(e) =>
                      onTierFeaturesChange(tier.id, e.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="docsMarkdown">API documentation (markdown)</Label>
        <Textarea
          id="docsMarkdown"
          value={docsMarkdown}
          onChange={(e) => onDocsMarkdownChange(e.target.value)}
          className="mt-1.5 min-h-[220px] font-mono text-xs"
        />
        <p className="mt-2 text-xs text-[var(--muted)]">
          Shown on your public page for {productName}.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          Documentation preview
        </p>
        <ProductDocs markdown={docsMarkdown} />
      </div>
    </div>
  );
}

export function plansToEditable(plans: SubscriptionPlan[]): EditableTier[] {
  return plans.map((p) => ({
    id: p.id,
    name: p.name,
    price_ngn: Number(p.price_ngn),
    limit_per_month: p.limit_per_month,
    features: p.features ?? [],
    description: undefined,
  }));
}
