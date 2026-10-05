-- hayzaydee.me: visual overhaul foundation
-- Apply in the Supabase SQL editor (or `supabase db push`). Idempotent: safe to re-run.

begin;

-- ── Projects: admin-selected identity field for /work/[project] ──────────────
-- visual_variant is an effect id from lib/fx/projectVisuals.ts; visual_accent is a palette
-- token key (e.g. 'workshop-syntax'), never a hex value. Allowed values are enforced in zod.
alter table public.projects
  add column if not exists visual_variant text,
  add column if not exists visual_accent  text;

alter table public.projects drop constraint if exists projects_visual_variant_format;
alter table public.projects add constraint projects_visual_variant_format
  check (visual_variant is null or visual_variant ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

alter table public.projects drop constraint if exists projects_visual_accent_token;
alter table public.projects add constraint projects_visual_accent_token
  check (visual_accent is null or visual_accent ~ '^[a-z]+(-[a-z0-9]+)*$');

-- ── Site settings: tuned effect presets saved from /admin/lab ────────────────
alter table public.site_settings
  add column if not exists fx_presets jsonb not null default '{}'::jsonb;

alter table public.site_settings drop constraint if exists site_settings_fx_presets_object;
alter table public.site_settings add constraint site_settings_fx_presets_object
  check (jsonb_typeof(fx_presets) = 'object');

-- ── Wall: sealed pieces must not be readable before they unseal ──────────────
-- The previous policy exposed every 'scheduled' row (image paths included) to the anon key.
drop policy if exists "anon read published wall_pieces" on public.wall_pieces;
drop policy if exists "anon read visible wall_pieces"   on public.wall_pieces;
create policy "anon read visible wall_pieces"
  on public.wall_pieces for select to anon
  using (
    status = 'published'
    or (status = 'scheduled' and publish_at is not null and publish_at <= now())
  );

-- Sealed teasers expose only what the wall needs to render a seal: no media, no caption.
create or replace function public.sealed_wall_pieces()
returns table (id uuid, type text, publish_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select w.id, w.type, w.publish_at
  from public.wall_pieces w
  where w.status = 'scheduled' and w.publish_at > now()
  order by w.publish_at
  limit 12;
$$;

revoke all on function public.sealed_wall_pieces() from public;
grant execute on function public.sealed_wall_pieces() to anon, authenticated;

-- ── Storage: buckets the upload actions actually write to ────────────────────
-- app/actions/wall.ts uploads to wall-images / wall-videos; the original schema created
-- wall-art / wall-previews instead. Creating these is a no-op if they already exist.
insert into storage.buckets (id, name, public)
values ('wall-images', 'wall-images', true), ('wall-videos', 'wall-videos', true)
on conflict (id) do nothing;

drop policy if exists "public read wall-images storage" on storage.objects;
create policy "public read wall-images storage"
  on storage.objects for select to anon
  using (bucket_id = 'wall-images');

drop policy if exists "public read wall-videos storage" on storage.objects;
create policy "public read wall-videos storage"
  on storage.objects for select to anon
  using (bucket_id = 'wall-videos');

commit;
