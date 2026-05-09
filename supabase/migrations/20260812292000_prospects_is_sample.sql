-- Prospects: is_sample so Settings → sample reset can delete demo leads without touching real pipelines.

alter table public.prospects
  add column if not exists is_sample boolean not null default false;

comment on column public.prospects.is_sample is
  'True when this prospect was created by demo/sample seeding; sample-data reset deletes these rows only (scoped by organization_id).';

create index if not exists idx_prospects_org_sample
  on public.prospects (organization_id)
  where is_sample = true;

-- Precision biomedical demo uses @pbs-lead.demo.local for seeded leads.
update public.prospects p
set is_sample = true
where p.contact_email is not null
  and lower(p.contact_email::text) like '%@pbs-lead.demo.local';
