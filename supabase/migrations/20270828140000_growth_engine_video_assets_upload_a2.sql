-- Growth Engine A2 — Video asset upload tracking + growth-videos storage bucket.

do $$
begin
  if to_regclass('growth.video_assets') is null then
    raise exception 'Missing dependency: growth.video_assets';
  end if;
end;
$$;

alter table growth.video_assets
  add column if not exists original_filename text,
  add column if not exists mime_type text,
  add column if not exists file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  add column if not exists upload_status text not null default 'pending'
    check (upload_status in ('pending', 'uploading', 'uploaded', 'failed')),
  add column if not exists processing_error text;

create index if not exists idx_growth_video_assets_org_upload_status
  on growth.video_assets (organization_id, upload_status, updated_at desc);

-- -----------------------------------------------------------------------------
-- storage bucket (private — signed access only, 250MB video uploads)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'growth-videos',
  'growth-videos',
  false,
  262144000,
  array['video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
