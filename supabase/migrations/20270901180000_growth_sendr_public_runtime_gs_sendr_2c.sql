-- GS-SENDR-2C — Public page runtime (slug + published metadata)
-- Additive only. Do not apply until bundled deploy.

alter table growth.growth_landing_pages
  add column if not exists slug text,
  add column if not exists published_slug text,
  add column if not exists published_version integer,
  add column if not exists published_at timestamptz;

create unique index if not exists growth_landing_pages_published_slug_uidx
  on growth.growth_landing_pages (published_slug)
  where published_slug is not null and deleted_at is null;

create index if not exists growth_landing_pages_slug_idx
  on growth.growth_landing_pages (slug)
  where slug is not null and deleted_at is null;

alter table growth.growth_landing_page_publications
  add column if not exists version_number integer,
  add column if not exists published_slug text;

create index if not exists growth_landing_page_publications_slug_idx
  on growth.growth_landing_page_publications (published_slug, published_at desc)
  where published_slug is not null;
