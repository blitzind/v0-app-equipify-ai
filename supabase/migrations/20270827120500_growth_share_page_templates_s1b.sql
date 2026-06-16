-- Growth Engine S1-B — Share Page Template foundation.
-- Reusable template library with versioned blocks_json + theme_json. Human-gated publish only.

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
-- growth.share_page_templates
-- -----------------------------------------------------------------------------

create table if not exists growth.share_page_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  name text not null check (char_length(trim(name)) > 0),
  description text not null default '',
  category text not null default 'general',
  tags text[] not null default '{}'::text[],
  preview_image_url text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  archived_at timestamptz,
  current_version_id uuid,
  published_version_id uuid,
  requires_human_review boolean not null default true,
  qa_marker text not null default 'growth-share-page-templates-s1-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_share_page_templates_organization
  on growth.share_page_templates (organization_id, status, updated_at desc);

create index if not exists idx_growth_share_page_templates_status
  on growth.share_page_templates (status, updated_at desc);

create index if not exists idx_growth_share_page_templates_category
  on growth.share_page_templates (category, status, updated_at desc);

create index if not exists idx_growth_share_page_templates_tags
  on growth.share_page_templates using gin (tags);

comment on table growth.share_page_templates is
  'Reusable Share Page templates — draft/publish/archive only; no live page publish.';

comment on column growth.share_page_templates.requires_human_review is
  'Template publish requires operator action — no autonomous promotion.';

-- -----------------------------------------------------------------------------
-- growth.share_page_template_versions
-- -----------------------------------------------------------------------------

create table if not exists growth.share_page_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references growth.share_page_templates (id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  blocks_json jsonb not null default '[]'::jsonb,
  theme_json jsonb not null default '{}'::jsonb,
  default_booking_page_id uuid references growth.booking_pages (id) on delete set null,
  merge_fields_used jsonb not null default '[]'::jsonb,
  change_summary text not null default '',
  is_immutable boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  published_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (template_id, version_number)
);

create index if not exists idx_growth_share_page_template_versions_template
  on growth.share_page_template_versions (template_id, version_number desc);

create index if not exists idx_growth_share_page_template_versions_status
  on growth.share_page_template_versions (status, created_at desc);

comment on table growth.share_page_template_versions is
  'Immutable published template versions — editing published template creates new draft version.';

-- -----------------------------------------------------------------------------
-- FK back-references for current/published version pointers
-- -----------------------------------------------------------------------------

alter table growth.share_page_templates
  add constraint share_page_templates_current_version_fk
  foreign key (current_version_id) references growth.share_page_template_versions (id) on delete set null;

alter table growth.share_page_templates
  add constraint share_page_templates_published_version_fk
  foreign key (published_version_id) references growth.share_page_template_versions (id) on delete set null;

-- -----------------------------------------------------------------------------
-- updated_at trigger
-- -----------------------------------------------------------------------------

drop trigger if exists set_share_page_templates_updated_at on growth.share_page_templates;
create trigger set_share_page_templates_updated_at
  before update on growth.share_page_templates
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — service role only (Growth Engine pattern)
-- -----------------------------------------------------------------------------

alter table growth.share_page_templates enable row level security;
alter table growth.share_page_templates force row level security;
alter table growth.share_page_template_versions enable row level security;
alter table growth.share_page_template_versions force row level security;

grant select, insert, update, delete on growth.share_page_templates to service_role;
grant select, insert, update, delete on growth.share_page_template_versions to service_role;
