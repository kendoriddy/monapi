export type Profile = {
  id: string;
  updated_at: string | null;
  full_name: string | null;
  email: string | null;
};

export type EmailPreview = {
  to: string;
  subject: string;
  html: string;
  sent: boolean;
};

export type ApiProduct = {
  id: string;
  developer_id: string;
  name: string;
  target_url: string;
  description: string | null;
  landing_copy: string | null;
  slug: string;
  docs_markdown: string | null;
  is_live: boolean;
  created_at: string;
};

export type SubscriptionPlan = {
  id: string;
  product_id: string;
  name: string;
  price_ngn: number;
  limit_per_month: number;
  features: string[] | null;
  monnify_plan_code: string | null;
  created_at: string;
};

export type CustomerSubscription = {
  id: string;
  plan_id: string;
  customer_email: string;
  customer_name: string | null;
  api_key: string;
  status: string;
  monnify_transaction_reference: string | null;
  requests_this_month: number;
  usage_reset_at: string | null;
  email_preview: EmailPreview | null;
  created_at: string;
};

export type AiPlanTier = {
  name: string;
  price_ngn: number;
  limit_per_month: number;
  features: string[];
  description?: string;
};

export type AiPlanResponse = {
  product_name: string;
  landing_copy: string;
  docs_markdown: string;
  tiers: AiPlanTier[];
};
