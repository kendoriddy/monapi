-- Migration for existing Monapi Supabase projects
alter table api_products add column if not exists slug text;
alter table api_products add column if not exists docs_markdown text;
update api_products set slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')) where slug is null;
alter table api_products alter column slug set not null;
create unique index if not exists api_products_slug_key on api_products (slug);

alter table customer_subscriptions add column if not exists requests_this_month integer not null default 0;
alter table customer_subscriptions add column if not exists usage_reset_at timestamp with time zone;
alter table customer_subscriptions add column if not exists email_preview jsonb;
