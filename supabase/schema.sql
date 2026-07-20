-- Monapi / MonetizeAPI — Supabase PostgreSQL schema
-- Run this in the Supabase SQL Editor before starting the app.

create extension if not exists "uuid-ossp";

-- 1. Developers (mapped from Supabase Auth users)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  updated_at timestamp with time zone,
  full_name text,
  email text
);

-- 2. API Products
create table if not exists api_products (
  id uuid default gen_random_uuid() primary key,
  developer_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  target_url text not null,
  description text,
  landing_copy text,
  slug text unique not null,
  docs_markdown text,
  is_live boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Subscription Plans (AI-generated, Monnify-backed)
create table if not exists subscription_plans (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references api_products(id) on delete cascade not null,
  name text not null,
  price_ngn numeric not null,
  limit_per_month integer not null,
  features text[],
  monnify_plan_code text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Customer Subscriptions (provisioned via Monnify webhooks)
create table if not exists customer_subscriptions (
  id uuid default gen_random_uuid() primary key,
  plan_id uuid references subscription_plans(id) on delete cascade not null,
  customer_email text not null,
  customer_name text,
  api_key text unique not null,
  status text not null default 'active',
  monnify_transaction_reference text unique,
  requests_this_month integer not null default 0,
  usage_reset_at timestamp with time zone,
  email_preview jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, updated_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.email,
    now()
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Row Level Security
alter table profiles enable row level security;
alter table api_products enable row level security;
alter table subscription_plans enable row level security;
alter table customer_subscriptions enable row level security;

create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Developers manage own products"
  on api_products for all using (auth.uid() = developer_id);

create policy "Public can read live products"
  on api_products for select using (is_live = true);

create policy "Developers manage plans for own products"
  on subscription_plans for all using (
    exists (
      select 1 from api_products p
      where p.id = product_id and p.developer_id = auth.uid()
    )
  );

create policy "Public can read plans for live products"
  on subscription_plans for select using (
    exists (
      select 1 from api_products p
      where p.id = product_id and p.is_live = true
    )
  );

create policy "Developers can read subscriptions for own products"
  on customer_subscriptions for select using (
    exists (
      select 1 from subscription_plans sp
      join api_products p on p.id = sp.product_id
      where sp.id = plan_id and p.developer_id = auth.uid()
    )
  );

-- 5. Pending checkouts (maps Monnify paymentReference → plan)
create table if not exists pending_checkouts (
  payment_reference text primary key,
  plan_id uuid references subscription_plans(id) on delete cascade not null,
  product_id uuid references api_products(id) on delete cascade not null,
  customer_email text not null,
  customer_name text,
  amount numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table pending_checkouts enable row level security;

-- Service role bypasses RLS for webhooks / checkout provisioning
