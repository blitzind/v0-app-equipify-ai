-- Growth Engine S1.5 — Media asset foundation (persistence + relationships + storage bucket).
-- Human-gated only — no autonomous upload, playback, or provider execution in S1.5.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'Missing dependency: public.set_updated_at()';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.media_assets
-- -----------------------------------------------------------------------------

create table if not exists growth.media_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  asset_type text not null
    check (asset_type in (
      'video', 'audio', 'image', 'thumbnail', 'waveform',
      'avatar_video', 'voice_clone', 'generated_video', 'generated_audio', 'other'
    )),
  provider text not null default 'local_stub'
    check (provider in ('local_stub', 'supabase_storage', 'future_s3', 'future_cloudflare_r2')),
  status text not null default 'draft'
    check (status in ('draft', 'upload_pending', 'uploaded', 'processing', 'ready', 'archived', 'failed')),
  title text not null default '',
  description text not null default '',
  storage_key text,
  original_filename text,
  mime_type text,
  extension text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  duration_seconds numeric(12, 3) check (duration_seconds is null or duration_seconds >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  thumbnail_storage_key text,
  waveform_storage_key text,
  metadata_json jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}'::text[],
  checksum_sha256 text,
  source text not null default 'manual'
    check (source in ('manual', 'upload', 'generated', 'import', 'other')),
  source_reference text,
  requires_human_review boolean not null default true,
  qa_marker text not null default 'growth-media-assets-s1-5-v1',
  uploaded_at timestamptz,
  processed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_media_assets_organization
  on growth.media_assets (organization_id, status, updated_at desc);

create index if not exists idx_growth_media_assets_asset_type
  on growth.media_assets (asset_type, status, updated_at desc);

create index if not exists idx_growth_media_assets_status
  on growth.media_assets (status, updated_at desc);

create index if not exists idx_growth_media_assets_provider
  on growth.media_assets (provider, status, updated_at desc);

create index if not exists idx_growth_media_assets_tags
  on growth.media_assets using gin (tags);

create index if not exists idx_growth_media_assets_storage_key
  on growth.media_assets (storage_key)
  where storage_key is not null;

comment on table growth.media_assets is
  'Growth media asset registry — metadata + storage keys only in S1.5; no playback or generation.';

comment on column growth.media_assets.requires_human_review is
  'Asset promotion/processing requires operator action — no autonomous execution.';

-- -----------------------------------------------------------------------------
-- growth.media_asset_relationships
-- -----------------------------------------------------------------------------

create table if not exists growth.media_asset_relationships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  asset_id uuid not null references growth.media_assets (id) on delete cascade,
  relationship_type text not null
    check (relationship_type in (
      'share_page_template', 'share_page', 'campaign', 'lead', 'sequence',
      'booking', 'email_asset', 'sms_asset', 'voice_drop', 'other'
    )),
  relationship_id uuid not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (asset_id, relationship_type, relationship_id)
);

create index if not exists idx_growth_media_asset_relationships_organization
  on growth.media_asset_relationships (organization_id, created_at desc);

create index if not exists idx_growth_media_asset_relationships_asset_id
  on growth.media_asset_relationships (asset_id, relationship_type);

create index if not exists idx_growth_media_asset_relationships_relationship_type
  on growth.media_asset_relationships (relationship_type, relationship_id);

create index if not exists idx_growth_media_asset_relationships_relationship_id
  on growth.media_asset_relationships (relationship_id, relationship_type);

comment on table growth.media_asset_relationships is
  'Links media assets to Growth entities — attach/detach only; no side effects in S1.5.';

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------

drop trigger if exists trg_growth_media_assets_updated_at on growth.media_assets;
create trigger trg_growth_media_assets_updated_at
  before update on growth.media_assets
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

alter table growth.media_assets enable row level security;
alter table growth.media_assets force row level security;

alter table growth.media_asset_relationships enable row level security;
alter table growth.media_asset_relationships force row level security;

revoke all on growth.media_assets from public, anon, authenticated;
revoke all on growth.media_asset_relationships from public, anon, authenticated;

grant select, insert, update, delete on growth.media_assets to service_role;
grant select, insert, update, delete on growth.media_asset_relationships to service_role;

drop policy if exists growth_media_assets_service_role on growth.media_assets;
create policy growth_media_assets_service_role
  on growth.media_assets
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists growth_media_asset_relationships_service_role on growth.media_asset_relationships;
create policy growth_media_asset_relationships_service_role
  on growth.media_asset_relationships
  for all
  to service_role
  using (true)
  with check (true);

-- -----------------------------------------------------------------------------
-- storage bucket (private — signed access only)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'growth-media-assets',
  'growth-media-assets',
  false,
  524288000,
  array[
    'video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav', 'audio/ogg',
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/json'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
