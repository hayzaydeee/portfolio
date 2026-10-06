-- hayzaydee.me: fixes for the Supabase security advisor (2026-10-05)
-- Apply in the Supabase SQL editor after 20261005120000_fx_overhaul.sql. Idempotent.
--
-- Accepted, not changed: sealed_wall_pieces() stays SECURITY DEFINER and callable by anon.
-- That is its job: the wall shows sealed teasers to visitors, and anon RLS hides future rows,
-- so the function returns only id, type and publish_at for them.

begin;

-- ── 0011 function_search_path_mutable ────────────────────────────────────────
-- now() lives in pg_catalog, which is always searched, so an empty path is safe here.
alter function public.update_updated_at() set search_path = '';

-- ── 0025 public_bucket_allows_listing ────────────────────────────────────────
-- Every read goes through /storage/v1/object/public/..., which public buckets serve without
-- any storage.objects policy. Uploads use the service role, which bypasses RLS. These SELECT
-- policies only let the anon key list every file in each bucket.
drop policy if exists "public read projects storage"      on storage.objects;
drop policy if exists "public read music-covers storage"  on storage.objects;
drop policy if exists "public read music-audio storage"   on storage.objects;
drop policy if exists "public read wall-images storage"   on storage.objects;
drop policy if exists "public read wall-videos storage"   on storage.objects;
drop policy if exists "public read wall-art storage"      on storage.objects;
drop policy if exists "public read wall-previews storage" on storage.objects;

-- ── 0026 / 0027 pg_graphql table exposure ────────────────────────────────────
-- The app only talks to PostgREST (supabase-js), never /graphql/v1. Dropping the extension
-- removes the introspectable schema; anon REST reads are still limited by RLS.
-- Guarded so an ownership error on a managed project can't roll back the rest; if it notices,
-- disable pg_graphql in Dashboard → Database → Extensions instead.
do $$
begin
  drop extension if exists pg_graphql;
exception when others then
  raise notice 'pg_graphql not dropped (%): disable it from the dashboard', sqlerrm;
end $$;

-- site_settings holds the bito webhook secret and is only read with the service role.
-- RLS already returns no rows to anon; revoking the grants removes the table from the API.
revoke all on table public.site_settings from anon, authenticated;

-- ── 0028 / 0029 rls_auto_enable() executable over RPC ────────────────────────
-- An event-trigger helper; it fires from the event trigger, never from /rest/v1/rpc.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

commit;
