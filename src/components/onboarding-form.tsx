"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PricingCards } from "@/components/pricing-cards";
import type { AiPlanResponse } from "@/lib/types";

export function OnboardingForm({ demoMode }: { demoMode: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("https://api.example.com/v1");
  const [description, setDescription] = useState(
    "I have an OCR API that reads vehicle license plates",
  );
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<AiPlanResponse | null>(null);
  const [productId, setProductId] = useState<string | null>(null);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, targetUrl, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate hub");

      setPreview(data.blueprint as AiPlanResponse);
      setProductId(data.product.id as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoLive() {
    if (!productId) return;
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/products/${productId}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to publish");
      router.push(`/p/${productId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleGenerate} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">API name</Label>
            <Input
              id="name"
              required
              placeholder="PlateVision OCR"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="url">Backend endpoint</Label>
            <Input
              id="url"
              required
              type="url"
              placeholder="https://api.yourservice.com/v1"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="description">Describe your API</Label>
          <Textarea
            id="description"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {demoMode && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Demo mode is on — data persists locally in <code>.data/</code>. Add
            Supabase env vars for production auth & storage.
          </p>
        )}

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={loading} className="w-full sm:w-auto">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating hub…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Monetization Hub
            </>
          )}
        </Button>
      </form>

      {preview && (
        <div className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
              Step 2 · Preview & Publish
            </p>
            <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--foreground)]">
              {preview.product_name}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
              {preview.landing_copy}
            </p>
          </div>

          <PricingCards plans={preview.tiers} />

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button onClick={handleGoLive} disabled={publishing || !productId}>
              {publishing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Going live…
                </>
              ) : (
                "Go Live"
              )}
            </Button>
            {productId && (
              <p className="text-xs text-[var(--muted)]">
                Public URL will be <code>/p/{productId}</code>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
