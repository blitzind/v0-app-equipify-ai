-- GE-AIOS-8A-3 — Business Intelligence reports (Evidence Engine consumer).

do $$
begin
  if to_regclass('growth.evidence_engine_snapshots') is null then
    raise exception 'Missing dependency: growth.evidence_engine_snapshots';
  end if;
end;
$$;

create table if not exists growth.business_intelligence_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  organization_id uuid not null references public.organizations (id) on delete cascade,
  evidence_snapshot_id uuid not null references growth.evidence_engine_snapshots (id) on delete cascade,
  evidence_run_id uuid not null references growth.evidence_engine_runs (id) on delete cascade,
  status text not null default 'completed'
    check (status in ('completed', 'empty', 'partial', 'failed')),
  report_json jsonb not null default '{}'::jsonb,
  confidence_summary jsonb not null default '{}'::jsonb,
  gaps_json jsonb not null default '[]'::jsonb,
  source_providers text[] not null default '{}',
  generated_at timestamptz not null default now(),
  is_current boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists business_intelligence_reports_org_generated_idx
  on growth.business_intelligence_reports (organization_id, generated_at desc);

create unique index if not exists business_intelligence_reports_org_current_unique
  on growth.business_intelligence_reports (organization_id)
  where is_current = true;

create index if not exists business_intelligence_reports_snapshot_idx
  on growth.business_intelligence_reports (evidence_snapshot_id);

revoke all on table growth.business_intelligence_reports from public, anon, authenticated;
grant select, insert, update, delete on table growth.business_intelligence_reports to service_role;

alter table growth.business_intelligence_reports enable row level security;

comment on table growth.business_intelligence_reports is
  'GE-AIOS-8A-3 deterministic Business Intelligence reports derived from Evidence Engine snapshots. Does not replace organization_business_profiles.';
