-- GE-AIOS-8A-7 — Business Intelligence operator review decisions.

do $$
begin
  if to_regclass('growth.business_intelligence_reports') is null then
    raise exception 'Missing dependency: growth.business_intelligence_reports';
  end if;
end;
$$;

create table if not exists growth.business_intelligence_review_decisions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_intelligence_report_id uuid not null references growth.business_intelligence_reports (id) on delete cascade,
  evidence_snapshot_id uuid not null references growth.evidence_engine_snapshots (id) on delete cascade,
  field_key text not null,
  original_value_json jsonb,
  approved_value_json jsonb,
  decision text not null
    check (decision in ('approved', 'edited', 'dismissed', 'marked_unknown', 'needs_more_info')),
  confidence_at_decision numeric,
  supporting_evidence_ids text[] not null default '{}',
  decided_by uuid,
  decided_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists business_intelligence_review_decisions_report_field_unique
  on growth.business_intelligence_review_decisions (organization_id, business_intelligence_report_id, field_key);

create index if not exists business_intelligence_review_decisions_org_report_idx
  on growth.business_intelligence_review_decisions (organization_id, business_intelligence_report_id, decided_at desc);

revoke all on table growth.business_intelligence_review_decisions from public, anon, authenticated;
grant select, insert, update, delete on table growth.business_intelligence_review_decisions to service_role;

alter table growth.business_intelligence_review_decisions enable row level security;

comment on table growth.business_intelligence_review_decisions is
  'GE-AIOS-8A-7 operator review layer for Business Intelligence fields. Does not replace organization_business_profiles.';
