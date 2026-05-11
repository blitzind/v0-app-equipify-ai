-- Sample-data tooling: mark seeded technician_skill_tags rows so reset can remove them safely.
-- Runs immediately after 20260812200000_technician_skill_tags.sql (table must exist).

alter table public.technician_skill_tags
  add column if not exists is_sample boolean not null default false;

comment on column public.technician_skill_tags.is_sample is
  'True when created by demo/sample seeding; reset removes only sample-tagged rows.';

create index if not exists idx_technician_skill_tags_org_sample
  on public.technician_skill_tags (organization_id, is_sample)
  where is_sample = true;
