-- Human review / verification for AI-generated catalog lines, price list imports, and certificate templates.

-- Catalog items: provenance + who approved the data for operations
alter table public.catalog_items
  add column if not exists ai_generated boolean not null default false,
  add column if not exists ai_confidence numeric(6, 4),
  add column if not exists human_verified_at timestamptz,
  add column if not exists human_verified_by uuid references auth.users (id) on delete set null;

comment on column public.catalog_items.ai_generated is
  'True when the row was created or materially filled from AI price list extraction.';
comment on column public.catalog_items.ai_confidence is
  'Model / extraction confidence for the row (0–1) when ai_generated is true.';
comment on column public.catalog_items.human_verified_at is
  'Set when a manager approves the row for operational use (e.g. import commit or explicit verify).';
comment on column public.catalog_items.human_verified_by is
  'User who last marked the row verified.';

-- Price list import session: when a human completed a successful catalog commit
alter table public.price_list_imports
  add column if not exists human_reviewed_at timestamptz,
  add column if not exists human_reviewed_by uuid references auth.users (id) on delete set null;

comment on column public.price_list_imports.human_reviewed_at is
  'Set when selected extracted rows are committed to the catalog without errors.';

-- Calibration templates: AI import drafts vs human-approved saves
alter table public.calibration_templates
  add column if not exists ai_generated boolean not null default false,
  add column if not exists ai_confidence numeric(6, 4),
  add column if not exists human_verified_at timestamptz,
  add column if not exists human_verified_by uuid references auth.users (id) on delete set null;

comment on column public.calibration_templates.ai_generated is
  'True when the template was created from AI certificate import (fields still require human review before use).';
comment on column public.calibration_templates.human_verified_at is
  'Set when a manager saves the template after import review (operational trust boundary).';

create index if not exists idx_catalog_items_org_ai_verified
  on public.catalog_items (organization_id, ai_generated, human_verified_at);

create index if not exists idx_calibration_templates_org_ai_verified
  on public.calibration_templates (organization_id, ai_generated, human_verified_at);
