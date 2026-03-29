-- hayzaydee.me — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- After running: enable RLS on each table (see policies below)

-- ─────────────────────────────────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────────────────────────────────

create table if not exists projects (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  tagline       text,
  problem_notes text,
  build_notes   text,
  stack         text[],
  personal_note text,
  live_url      text,
  repo_url      text,
  thumbnail_url text,
  is_featured   boolean not null default false,
  status        text not null default 'draft'
                  check (status in ('published', 'draft', 'archived', 'in_progress')),
  order_index   integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists music_projects (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  description   text,
  artwork_path  text,
  release_year  integer,
  is_featured   boolean not null default false,
  is_wip        boolean not null default false,
  status        text not null default 'draft'
                  check (status in ('published', 'draft', 'archived')),
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists tracks (
  id               uuid primary key default gen_random_uuid(),
  music_project_id uuid not null references music_projects(id) on delete cascade,
  title            text not null,
  audio_path       text,
  duration_seconds integer,
  track_number     integer not null default 1,
  created_at       timestamptz not null default now()
);

create table if not exists analysis_essays (
  id                 uuid primary key default gen_random_uuid(),
  slug               text unique not null,
  title              text not null,
  subject            text not null default '',
  content            text,          -- MDX/Markdown
  body_html          text,          -- Tiptap HTML output
  read_time_minutes  integer,
  status             text not null default 'draft'
                       check (status in ('published', 'draft', 'archived')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists notebook_entries (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,
  journal           text not null
                      check (journal in ('reflections', 'fragments', 'annotations', 'responses', 'buildlog')),
  title             text,
  content           text,          -- MDX/Markdown
  body_html         text,          -- Tiptap HTML output
  read_time_minutes integer,
  source            text not null default 'admin'
                      check (source in ('admin', 'bito')),
  status            text not null default 'draft'
                      check (status in ('published', 'draft', 'staged', 'rejected', 'archived')),
  tags              text[],
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  published_at      timestamptz
);

create table if not exists wall_pieces (
  id          uuid primary key default gen_random_uuid(),
  type        text not null
                check (type in ('art', 'video_short', 'video_long')),
  caption     text,
  description text,
  image_path  text,
  preview_path text,         -- 30s Supabase video preview
  youtube_url text,
  duration    text,          -- e.g. "12:34" for long video
  alt_text    text,
  status      text not null default 'draft'
                check (status in ('published', 'draft', 'scheduled', 'hidden')),
  publish_at  timestamptz,   -- time capsule field
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists currently (
  id         uuid primary key default gen_random_uuid(),
  type       text not null
               check (type in ('project', 'music', 'thought', 'film', 'book')),
  verb       text not null,  -- e.g. 'building', 'listening', 'reading'
  content    text not null,
  link       text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists site_settings (
  id                      uuid primary key default gen_random_uuid(),
  room_workshop_visible   boolean not null default true,
  room_studio_visible     boolean not null default true,
  room_notebook_visible   boolean not null default true,
  room_wall_visible       boolean not null default true,
  bito_webhook_secret     text,
  last_bito_webhook_at    timestamptz,
  updated_at              timestamptz not null default now()
);

-- Insert the single settings row
insert into site_settings (id) values (gen_random_uuid())
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- TRIGGERS — auto-update updated_at
-- ─────────────────────────────────────────────────────────────────────

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_updated_at
  before update on projects
  for each row execute function update_updated_at();

create trigger music_projects_updated_at
  before update on music_projects
  for each row execute function update_updated_at();

create trigger analysis_essays_updated_at
  before update on analysis_essays
  for each row execute function update_updated_at();

create trigger notebook_entries_updated_at
  before update on notebook_entries
  for each row execute function update_updated_at();

create trigger wall_pieces_updated_at
  before update on wall_pieces
  for each row execute function update_updated_at();

create trigger site_settings_updated_at
  before update on site_settings
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────

alter table projects          enable row level security;
alter table music_projects    enable row level security;
alter table tracks            enable row level security;
alter table analysis_essays   enable row level security;
alter table notebook_entries  enable row level security;
alter table wall_pieces       enable row level security;
alter table currently         enable row level security;
alter table site_settings     enable row level security;

-- Anon: read only published/public content
create policy "anon read published projects"
  on projects for select to anon
  using (status = 'published');

create policy "anon read published music_projects"
  on music_projects for select to anon
  using (status = 'published');

create policy "anon read tracks of published projects"
  on tracks for select to anon
  using (
    exists (
      select 1 from music_projects mp
      where mp.id = tracks.music_project_id and mp.status = 'published'
    )
  );

create policy "anon read published analysis_essays"
  on analysis_essays for select to anon
  using (status = 'published');

create policy "anon read published notebook_entries"
  on notebook_entries for select to anon
  using (status = 'published');

create policy "anon read published wall_pieces"
  on wall_pieces for select to anon
  using (status in ('published', 'scheduled'));

create policy "anon read currently"
  on currently for select to anon
  using (true);

-- site_settings: no anon read (admin only)

-- Service role: full access (via SUPABASE_SERVICE_ROLE_KEY — bypasses RLS by default)
-- No additional policies needed for service role.

-- ─────────────────────────────────────────────────────────────────────
-- STORAGE BUCKETS
-- Run in SQL Editor (or create manually in Dashboard → Storage)
-- ─────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values
  ('projects',       'projects',       true),
  ('music-covers',   'music-covers',   true),
  ('music-audio',    'music-audio',    true),
  ('wall-art',       'wall-art',       true),
  ('wall-previews',  'wall-previews',  true)
on conflict (id) do nothing;

-- Storage policies: public read, no anon write
create policy "public read projects storage"
  on storage.objects for select to anon
  using (bucket_id = 'projects');

create policy "public read music-covers storage"
  on storage.objects for select to anon
  using (bucket_id = 'music-covers');

create policy "public read music-audio storage"
  on storage.objects for select to anon
  using (bucket_id = 'music-audio');

create policy "public read wall-art storage"
  on storage.objects for select to anon
  using (bucket_id = 'wall-art');

create policy "public read wall-previews storage"
  on storage.objects for select to anon
  using (bucket_id = 'wall-previews');
