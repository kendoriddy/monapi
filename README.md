# Monapi (MonetizeAPI)

**The Stripe Atlas for API Businesses in Africa.**

Paste an API endpoint → AI generates NGN tiers and docs → Monnify checkout → webhooks provision `sk_monapi_…` keys → Monapi gateway enforces auth and rate limits.

Built with **Next.js**, **Supabase**, **Monnify Sandbox**, **OpenAI/Gemini**, and **Resend**.

---

## Pitch demo script (fully offline — no API calls)

Toggle **Demo** in the header, then pick **Publisher** (developer) or **Subscriber**. Everything runs in the browser (`localStorage`); no `/api/*`, Supabase, Monnify, AI, or email.

### Developer (Publisher)

| Step | Action                                                                                   |
| ---- | ---------------------------------------------------------------------------------------- |
| 1    | **Demo** + **Publisher** → African Location API defaults → **Generate Monetization Hub** |
| 2    | Edit tiers/docs (Pro locked at **₦15,000**) → **Publish** → `/p/african-location-api`    |
| 3    | Select **Pro** → **Subscribe** → simulated Monnify → **Pay**                             |
| 4    | `/success` shows API key, demo inbox, **Run test request** (mock Nigerian states JSON)   |

### Subscriber

| Step | Action                                                                    |
| ---- | ------------------------------------------------------------------------- |
| 1    | **Demo** + **Subscriber** → marketplace shows seeded African Location API |
| 2    | Open hub → Pro → simulated checkout → success + run request               |

Switch to **Live** for real Supabase / Monnify / AI / Resend.

---

## Quick start

```bash
npm install
cp .env.example .env.local   # optional until you wire integrations
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo mode

Active when the header runtime is **Demo** (or `MONAPI_DEMO_MODE=true`):

- Single browser catalog in `localStorage` (seeded African Location API)
- Simulated Monnify page: `/checkout/demo`
- Demo inbox preview on success
- Gateway “Run request” returns mock Nigerian states JSON locally — zero network

---

## Environment variables

| Variable                                                           | Purpose                         |
| ------------------------------------------------------------------ | ------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                                         | Supabase project URL            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                    | Auth client                     |
| `SUPABASE_SERVICE_ROLE_KEY`                                        | Webhooks, gateway, public reads |
| `MONNIFY_API_KEY` / `MONNIFY_SECRET_KEY` / `MONNIFY_CONTRACT_CODE` | Sandbox checkout + webhook HMAC |
| `OPENAI_API_KEY` or `GEMINI_API_KEY`                               | AI tiers + docs                 |
| `RESEND_API_KEY`                                                   | Customer API key emails         |
| `MONAPI_DEMO_MODE`                                                 | Force local demo store          |
| `MONAPI_GATEWAY_MOCK`                                              | Force mock gateway responses    |

Never commit secrets. Use `.env.local`.

---

## Supabase

1. Run [`supabase/schema.sql`](./supabase/schema.sql) on a new project.
2. Existing DB: run [`supabase/migration-demo-fields.sql`](./supabase/migration-demo-fields.sql).
3. Enable **GitHub OAuth**; redirect: `http://localhost:3000/auth/callback`.

### Schema highlights

- `api_products.slug` — public URL `/p/[slug]`
- `api_products.docs_markdown` — landing docs
- `customer_subscriptions.requests_this_month` — gateway rate limits
- `pending_checkouts` — Monnify `MONAPI_…` reference → plan

---

## Architecture

```
Developer endpoint → AI plan + docs → Publish /p/slug
  → Monnify init (or /checkout/demo)
  → Webhook PAID → provision key + Resend
  → GET /api/v1/[slug] (auth + rate limit + proxy/mock)
```

### Key routes

| Route                             | Role                             |
| --------------------------------- | -------------------------------- |
| `POST /api/products`              | Create product + AI tiers        |
| `POST /api/products/[id]/publish` | Go live                          |
| `POST /api/checkout/initialize`   | Monnify or demo checkout URL     |
| `POST /api/webhooks/monnify`      | Signature verify, provision key  |
| `/api/v1/[slug]`                  | API gateway                      |
| `/p/[slug]`                       | Public landing + checkout + docs |
| `/checkout/demo`                  | Filmable Monnify sandbox UI      |
| `/success?ref=`                   | Key + inbox + run request        |

---

## Scripts

```bash
npm run dev
npm run build
npm run lint
```

---

## License

MIT — built for hackathon demos and African API founders.
