import type { AiPlanResponse, ApiProduct, SubscriptionPlan } from "@/lib/types";
import { slugifyProductName } from "@/lib/utils";

/** Stable IDs so Subscriber seed + deep links always work. */
export const AFRICAN_LOCATION_PRODUCT_ID = "demo-product-african-location";
export const AFRICAN_LOCATION_SLUG = "african-location-api";
export const AFRICAN_LOCATION_PLAN_IDS = {
  starter: "demo-plan-starter",
  pro: "demo-plan-pro",
  enterprise: "demo-plan-enterprise",
} as const;

export const AFRICAN_LOCATION_NAME = "African Location API";
export const AFRICAN_LOCATION_TARGET_URL =
  "https://api.africanlocations.dev/v1";

/** Paste-ready description for the Publisher “Describe your API” step. */
export const AFRICAN_LOCATION_DESCRIPTION = `African Location API — comprehensive geographic data for Nigeria, expanding across West Africa and eventually the entire continent.

Base URL: https://api.africanlocations.dev/v1

Routes:
- GET /states — list all Nigerian states (name, code, capital, region)
- GET /states/{code}/lgas — Local Government Areas for a state
- GET /cities?state={code} — cities and towns
- GET /capitals — state capitals with coordinates
- GET /postal-codes?city={name} — postal / ZIP codes
- GET /landmarks?state={code} — notable landmarks and POIs
- GET /geocode?q={place} — latitude and longitude for a place
- GET /distance?from={lat,lng}&to={lat,lng} — distance between two points (km)

Auth today: none on the origin. I want Monapi to add API keys, subscription plans, NGN billing via Monnify, usage limits, webhooks, and hosted docs so developers can subscribe and call the gateway.`;

function isAfricanLocationProduct(name: string, description: string): boolean {
  const haystack = `${name} ${description}`.toLowerCase();
  return (
    haystack.includes("african location") ||
    haystack.includes("africanlocations") ||
    (haystack.includes("states") &&
      haystack.includes("lgas") &&
      haystack.includes("postal"))
  );
}

function genericDocsMarkdown(
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

function africanLocationDocsMarkdown(slug: string, targetUrl: string): string {
  return `## African Location API — Quickstart

Reliable African geographic data through the Monapi gateway. Starts with **Nigeria**, expanding across **West Africa**, with a goal of covering the **entire continent**.

Authenticate with your \`sk_monapi_…\` key on every request.

### Base URL

\`\`\`
/api/v1/${slug}
\`\`\`

### Authentication

\`\`\`
Authorization: Bearer sk_monapi_your_key
\`\`\`

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | \`/states\` | List Nigerian states (name, code, capital, region) |
| GET | \`/states/{code}/lgas\` | Local Government Areas for a state |
| GET | \`/cities?state={code}\` | Cities and towns |
| GET | \`/capitals\` | State capitals with coordinates |
| GET | \`/postal-codes?city={name}\` | Postal codes |
| GET | \`/landmarks?state={code}\` | Landmarks and points of interest |
| GET | \`/geocode?q={place}\` | Latitude / longitude for a place |
| GET | \`/distance?from=&to=\` | Distance between two points (km) |

### Example — list states

\`\`\`bash
curl -X GET "https://your-monapi-host/api/v1/${slug}/states" \\
  -H "Authorization: Bearer sk_monapi_your_key" \\
  -H "Content-Type: application/json"
\`\`\`

### Example — distance between places

\`\`\`bash
curl -X GET "https://your-monapi-host/api/v1/${slug}/distance?from=6.5244,3.3792&to=9.0765,7.3986" \\
  -H "Authorization: Bearer sk_monapi_your_key"
\`\`\`

### Upstream

Origin API: \`${targetUrl}\`

### Rate limits

Limits depend on your plan (Starter / Pro / Enterprise). When exceeded, the gateway returns **429 Too Many Requests**.

### Errors

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid API key |
| 429 | Monthly request limit reached |
`;
}

/** Deterministic hub blueprint — never calls AI. */
export function buildDemoBlueprint(input: {
  name: string;
  targetUrl: string;
  description: string;
}): AiPlanResponse {
  const short =
    input.name.trim() || input.description.trim().slice(0, 60) || "API Product";
  const slug = slugifyProductName(short);
  const location = isAfricanLocationProduct(short, input.description);

  if (location) {
    return {
      product_name: AFRICAN_LOCATION_NAME,
      landing_copy:
        "States, LGAs, cities, capitals, postal codes, landmarks, geocoding, and distances — starting with Nigeria and expanding across Africa. Subscribe in NGN, get an API key instantly.",
      docs_markdown: africanLocationDocsMarkdown(
        AFRICAN_LOCATION_SLUG,
        input.targetUrl || AFRICAN_LOCATION_TARGET_URL,
      ),
      tiers: [
        {
          name: "Starter",
          price_ngn: 0,
          limit_per_month: 1000,
          features: [
            "1,000 requests / month",
            "States, LGAs & cities",
            "Community support",
            "Sandbox-friendly docs",
          ],
          description: "Explore Nigerian location data with a free quota.",
        },
        {
          name: "Pro",
          price_ngn: 15000,
          limit_per_month: 50000,
          features: [
            "50,000 requests / month",
            "Geocode + distance APIs",
            "Landmarks & postal codes",
            "Email support + usage webhooks",
          ],
          description:
            "For logistics, fintech, and apps shipping to real users.",
        },
        {
          name: "Enterprise",
          price_ngn: 75000,
          limit_per_month: 500000,
          features: [
            "500,000 requests / month",
            "Priority support",
            "Custom rate limits",
            "Early access to new countries",
          ],
          description:
            "Scale nationwide coverage without worrying about ceilings.",
        },
      ],
    };
  }

  return {
    product_name: short,
    landing_copy: `Monetize ${short} with local NGN checkout and instant API key provisioning. Powered by Monapi.`,
    docs_markdown: genericDocsMarkdown(short, slug, input.targetUrl),
    tiers: [
      {
        name: "Starter",
        price_ngn: 0,
        limit_per_month: 1000,
        features: [
          "1,000 requests / month",
          "Community support",
          "Sandbox-friendly docs",
          `Target: ${input.targetUrl}`,
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

export function buildAfricanLocationSeed(): {
  product: ApiProduct;
  plans: SubscriptionPlan[];
} {
  const blueprint = buildDemoBlueprint({
    name: AFRICAN_LOCATION_NAME,
    targetUrl: AFRICAN_LOCATION_TARGET_URL,
    description: AFRICAN_LOCATION_DESCRIPTION,
  });
  const now = new Date().toISOString();
  const product: ApiProduct = {
    id: AFRICAN_LOCATION_PRODUCT_ID,
    developer_id: "demo-developer",
    name: blueprint.product_name,
    target_url: AFRICAN_LOCATION_TARGET_URL,
    description: AFRICAN_LOCATION_DESCRIPTION,
    landing_copy: blueprint.landing_copy,
    slug: AFRICAN_LOCATION_SLUG,
    docs_markdown: blueprint.docs_markdown,
    is_live: true,
    created_at: now,
  };
  const planIdByName: Record<string, string> = {
    Starter: AFRICAN_LOCATION_PLAN_IDS.starter,
    Pro: AFRICAN_LOCATION_PLAN_IDS.pro,
    Enterprise: AFRICAN_LOCATION_PLAN_IDS.enterprise,
  };
  const plans: SubscriptionPlan[] = blueprint.tiers.map((tier) => ({
    id: planIdByName[tier.name] ?? `demo-plan-${tier.name.toLowerCase()}`,
    product_id: product.id,
    name: tier.name,
    price_ngn: tier.name === "Pro" ? 15000 : tier.price_ngn,
    limit_per_month: tier.limit_per_month,
    features: tier.features,
    monnify_plan_code: null,
    created_at: now,
  }));
  return { product, plans };
}

export function buildApiKeyEmailHtml(input: {
  customerName: string;
  productName: string;
  planName: string;
  apiKey: string;
  curlSnippet: string;
}): string {
  return `
        <div style="font-family: ui-sans-serif, system-ui, sans-serif; line-height: 1.5; color: #0f172a;">
          <h1 style="font-size: 20px; color: #0f172a; margin: 0 0 12px;">Welcome to ${input.productName}</h1>
          <p style="color: #334155; margin: 0 0 8px;">Hi ${input.customerName || "there"},</p>
          <p style="color: #334155; margin: 0 0 12px;">Your <strong style="color: #0f172a;">${input.planName}</strong> subscription is active. Here's your API key:</p>
          <pre style="background:#0b1220;color:#e2e8f0;padding:16px;border-radius:8px;overflow-x:auto;">${input.apiKey}</pre>
          <p style="color: #334155; margin: 16px 0 8px;">Quick start:</p>
          <pre style="background:#0b1220;color:#e2e8f0;padding:16px;border-radius:8px;white-space:pre-wrap;overflow-x:auto;">${input.curlSnippet}</pre>
          <p style="color:#64748b;font-size:13px;margin:16px 0 0;">Powered by Monapi — the easiest way to sell your API in Africa.</p>
        </div>
      `;
}

export function mockGatewayResponse(
  product: Pick<ApiProduct, "name" | "slug">,
  path = "/states",
) {
  const location =
    product.slug === AFRICAN_LOCATION_SLUG ||
    isAfricanLocationProduct(product.name, "");
  const normalized = (path || "/states").replace(/^\//, "") || "states";

  if (location) {
    if (normalized.startsWith("distance")) {
      return {
        ok: true,
        monapi: true,
        product: product.slug,
        path: `/${normalized}`,
        mock: {
          from: { lat: 6.5244, lng: 3.3792, label: "Lagos" },
          to: { lat: 9.0765, lng: 7.3986, label: "Abuja" },
          distance_km: 536.2,
          unit: "km",
          message: "Distance calculated (Monapi demo gateway)",
        },
      };
    }
    if (normalized.startsWith("geocode")) {
      return {
        ok: true,
        monapi: true,
        product: product.slug,
        path: `/${normalized}`,
        mock: {
          query: "Lagos",
          lat: 6.5244,
          lng: 3.3792,
          country: "NG",
          message: "Geocode resolved (Monapi demo gateway)",
        },
      };
    }
    return {
      ok: true,
      monapi: true,
      product: product.slug,
      path: `/${normalized}`,
      mock: {
        country: "NG",
        count: 3,
        states: [
          {
            code: "LA",
            name: "Lagos",
            capital: "Ikeja",
            region: "South West",
          },
          {
            code: "FC",
            name: "FCT",
            capital: "Abuja",
            region: "North Central",
          },
          {
            code: "KN",
            name: "Kano",
            capital: "Kano",
            region: "North West",
          },
        ],
        message: "Nigerian states sample (Monapi demo gateway)",
      },
    };
  }

  return {
    ok: true,
    monapi: true,
    product: product.slug,
    path: path || "/",
    mock: {
      message: "Request authorized via Monapi gateway",
      timestamp: new Date().toISOString(),
    },
  };
}
