import OpenAI from "openai";
import type { AiPlanResponse } from "@/lib/types";
import { slugifyProductName } from "@/lib/utils";

const SYSTEM_PROMPT = `You are Monapi's pricing strategist for African API businesses.
Given a short description of a REST API and its base URL, return ONLY valid JSON (no markdown fences) with this shape:
{
  "product_name": string,
  "landing_copy": string (1-2 sentences, marketing tone),
  "docs_markdown": string (markdown quickstart: auth header, base URL via Monapi gateway /api/v1/{slug}, example request, rate limits, 401/429 errors),
  "tiers": [
    {
      "name": "Starter" | "Pro" | "Enterprise",
      "price_ngn": number,
      "limit_per_month": number,
      "features": string[] (3-5 short bullets),
      "description": string
    }
  ]
}
Rules:
- Exactly 3 tiers: Starter, Pro, Enterprise (in that order)
- Pro tier price_ngn MUST be exactly 15000
- Starter can be 0 NGN; Enterprise should be higher than Pro
- Prices in Nigerian Naira for African SMB customers
- Rate limits should scale with price`;

function fallbackDocsMarkdown(
  productName: string,
  slug: string,
  targetUrl: string,
): string {
  return `## ${productName} — Quickstart

All requests go through the Monapi gateway. Authenticate with your \`sk_monapi_…\` key.

### Base URL

\`\`\`
/api/v1/${slug}
\`\`\`

### Authentication

\`\`\`
Authorization: Bearer sk_monapi_your_key
\`\`\`

### Example request

\`\`\`bash
curl -X GET "https://your-monapi-host/api/v1/${slug}" \\
  -H "Authorization: Bearer sk_monapi_your_key" \\
  -H "Content-Type: application/json"
\`\`\`

### Upstream

Your API origin: \`${targetUrl}\`

### Rate limits

Limits depend on your plan (Starter / Pro / Enterprise). When exceeded, the gateway returns **429 Too Many Requests**.

### Errors

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid API key |
| 429 | Monthly request limit reached |
`;
}

function fallbackPlans(
  description: string,
  targetUrl: string,
  productName?: string,
): AiPlanResponse {
  const short =
    productName?.trim() || description.trim().slice(0, 60) || "API Product";
  const slug = slugifyProductName(short);
  return {
    product_name: short,
    landing_copy: `Monetize ${short} with local NGN checkout and instant API key provisioning. Powered by Monapi.`,
    docs_markdown: fallbackDocsMarkdown(short, slug, targetUrl),
    tiers: [
      {
        name: "Starter",
        price_ngn: 0,
        limit_per_month: 1000,
        features: [
          "1,000 requests / month",
          "Community support",
          "Sandbox-friendly docs",
          `Target: ${targetUrl}`,
        ],
        description: "Try the API with generous free quota.",
      },
      {
        name: "Pro",
        price_ngn: 15000,
        limit_per_month: 50000,
        features: [
          "50,000 requests / month",
          "Email support",
          "Usage webhooks",
          "99.5% uptime SLA",
        ],
        description: "For growing products shipping to real users.",
      },
      {
        name: "Enterprise",
        price_ngn: 75000,
        limit_per_month: 500000,
        features: [
          "500,000 requests / month",
          "Priority support",
          "Custom rate limits",
          "Dedicated onboarding",
        ],
        description: "Scale without worrying about ceilings.",
      },
    ],
  };
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("AI response was not valid JSON");
  }
}

function normalizePlans(
  raw: unknown,
  description: string,
  targetUrl: string,
  productNameHint?: string,
): AiPlanResponse {
  const data = raw as Partial<AiPlanResponse>;
  const fallback = fallbackPlans(description, targetUrl, productNameHint);

  if (!data?.tiers || !Array.isArray(data.tiers) || data.tiers.length < 3) {
    return fallback;
  }

  const tiers = data.tiers.slice(0, 3).map((tier, index) => {
    const defaults = fallback.tiers[index];
    let price = Number(tier.price_ngn ?? defaults.price_ngn);
    const name = String(tier.name || defaults.name);
    if (name === "Pro") price = 15000;
    return {
      name,
      price_ngn: price,
      limit_per_month: Number(tier.limit_per_month ?? defaults.limit_per_month),
      features: Array.isArray(tier.features)
        ? tier.features.map(String)
        : defaults.features,
      description: tier.description
        ? String(tier.description)
        : defaults.description,
    };
  });

  const product_name = String(
    data.product_name || productNameHint || description.slice(0, 60),
  );
  const slug = slugifyProductName(product_name);

  return {
    product_name,
    landing_copy: String(
      data.landing_copy ||
        `Sell access to your API across Africa with Monnify checkout.`,
    ),
    docs_markdown: String(
      data.docs_markdown || fallbackDocsMarkdown(product_name, slug, targetUrl),
    ),
    tiers,
  };
}

export async function generateMonetizationPlans(
  description: string,
  targetUrl: string,
  productNameHint?: string,
): Promise<AiPlanResponse> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
  const provider =
    process.env.AI_PROVIDER ||
    (process.env.GEMINI_API_KEY ? "gemini" : "openai");

  if (!apiKey) {
    console.warn(
      "[ai] No OPENAI_API_KEY or GEMINI_API_KEY — using fallback tiers",
    );
    return fallbackPlans(description, targetUrl, productNameHint);
  }

  try {
    if (provider === "gemini") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `${SYSTEM_PROMPT}\n\nAPI description: ${description}\nBase URL: ${targetUrl}\nProduct name hint: ${productNameHint ?? ""}`,
                  },
                ],
              },
            ],
            generationConfig: { temperature: 0.4 },
          }),
        },
      );

      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        error?: { message?: string };
      };

      if (!res.ok) {
        console.error("[ai] Gemini error", { message: json.error?.message });
        return fallbackPlans(description, targetUrl, productNameHint);
      }

      const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      return normalizePlans(
        extractJson(text),
        description,
        targetUrl,
        productNameHint,
      );
    }

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `API description: ${description}\nBase URL: ${targetUrl}\nProduct name: ${productNameHint ?? ""}`,
        },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "{}";
    return normalizePlans(
      extractJson(text),
      description,
      targetUrl,
      productNameHint,
    );
  } catch (error) {
    console.error("[ai] plan generation failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return fallbackPlans(description, targetUrl, productNameHint);
  }
}
