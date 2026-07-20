-- Fix Live-mode product creation: allow authenticated users to upsert
-- their own profile (required before api_products.developer_id FK insert).
-- Safe to re-run. App also upserts profiles via the service role as a fallback.

drop policy if exists "Users can insert own profile" on profiles;
create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);
