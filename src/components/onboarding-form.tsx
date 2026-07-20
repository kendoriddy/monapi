"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  HubPreviewEditor,
  plansToEditable,
  type EditableTier,
} from "@/components/hub-preview-editor";
import { runtimeFetchHeaders } from "@/lib/runtime-client";
import type { SubscriptionPlan } from "@/lib/types";

export function OnboardingForm({ demoMode }: { demoMode: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("PlateReader OCR");
  const [targetUrl, setTargetUrl] = useState(
    "https://api.platevision.test/v1/plates",
  );
  const [description, setDescription] = useState(
    "I have an OCR API that reads vehicle license plates",
  );
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [productSlug, setProductSlug] = useState<string | null>(null);
  const [productTitle, setProductTitle] = useState("");
  const [landingCopy, setLandingCopy] = useState("");
  const [docsMarkdown, setDocsMarkdown] = useState("");
  const [editableTiers, setEditableTiers] = useState<EditableTier[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: runtimeFetchHeaders(demoMode, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ name, targetUrl, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate hub");

      const blueprint = data.blueprint as {
        product_name: string;
        landing_copy: string;
        docs_markdown: string;
      };
      const plans = data.plans as SubscriptionPlan[];

      setProductId(data.product.id as string);
      setProductSlug(data.product.slug as string);
      setProductTitle(blueprint.product_name);
      setLandingCopy(blueprint.landing_copy);
      setDocsMarkdown(blueprint.docs_markdown);
      setEditableTiers(plansToEditable(plans));
      setShowPreview(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function updateTier(id: string, patch: Partial<EditableTier>) {
    setEditableTiers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
  }

  function updateTierFeatures(id: string, raw: string) {
    const features = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    updateTier(id, { features });
  }

  async function handlePublish() {
    if (!productId) return;
    setPublishing(true);
    setError(null);
    try {
      const patchRes = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: runtimeFetchHeaders(demoMode, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          landingCopy,
          docsMarkdown,
          tiers: editableTiers.map((t) => ({
            id: t.id,
            price_ngn: t.name === "Pro" ? 15000 : t.price_ngn,
            limit_per_month: t.limit_per_month,
            features: t.features,
            description: t.description,
          })),
        }),
      });
      const patchData = await patchRes.json();
      if (!patchRes.ok) {
        throw new Error(patchData.error || "Failed to save changes");
      }

      const pubRes = await fetch(`/api/products/${productId}/publish`, {
        method: "POST",
        headers: runtimeFetchHeaders(demoMode),
      });
      const pubData = await pubRes.json();
      if (!pubRes.ok) throw new Error(pubData.error || "Failed to publish");

      const slug = (pubData.product?.slug as string) || productSlug;
      router.push(`/p/${slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-8">
      {!showPreview && (
        <form onSubmit={handleGenerate} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">API name</Label>
              <Input
                id="name"
                required
                placeholder="PlateReader OCR"
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

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className="w-full sm:w-auto"
          >
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
      )}

      {showPreview && (
        <div className="space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
              Step 2 · Review, edit & publish
            </p>
            <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--foreground)]">
              {productTitle}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
              Confirm pricing and documentation below. Monapi will publish your
              hosted landing page, docs, and checkout when you&apos;re ready.
            </p>
          </div>

          <HubPreviewEditor
            productName={productTitle}
            landingCopy={landingCopy}
            onLandingCopyChange={setLandingCopy}
            docsMarkdown={docsMarkdown}
            onDocsMarkdownChange={setDocsMarkdown}
            tiers={editableTiers}
            onTierChange={updateTier}
            onTierFeaturesChange={updateTierFeatures}
            publicSlug={productSlug}
          />

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
            <Button onClick={handlePublish} disabled={publishing || !productId}>
              {publishing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Publishing…
                </>
              ) : (
                "Publish monetization hub"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={publishing}
              onClick={() => setShowPreview(false)}
            >
              Regenerate
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
