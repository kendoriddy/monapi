export type Profile = {
  id: string;
  updated_at: string | null;
  full_name: string | null;
  email: string | null;
};

export type ApiProduct = {
  id: string;
  developer_id: string;
  name: string;
  target_url: string;
  description: string | null;
  landing_copy: string | null;
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
  tiers: AiPlanTier[];
};
