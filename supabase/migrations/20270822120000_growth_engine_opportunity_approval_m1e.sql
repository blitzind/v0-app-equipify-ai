-- Growth Engine Opportunity Approval (M1-E) — human-confirmed draft → opportunity conversion.

do $$
begin
  if to_regclass('growth.opportunity_drafts') is null then
    raise exception 'Missing dependency: growth.opportunity_drafts';
  end if;
  if to_regclass('growth.opportunities') is null then
    raise exception 'Missing dependency: growth.opportunities';
  end if;
end;
$$;

alter table growth.opportunity_drafts
  drop constraint if exists opportunity_drafts_status_check;

alter table growth.opportunity_drafts
  add constraint opportunity_drafts_status_check
  check (status in ('draft', 'approved', 'rejected', 'stale', 'converted'));

alter table growth.opportunity_drafts
  add column if not exists opportunity_id uuid references growth.opportunities (id) on delete set null,
  add column if not exists converted_at timestamptz,
  add column if not exists converted_by uuid,
  add column if not exists converted_email text,
  add column if not exists conversion_metadata jsonb not null default '{}'::jsonb;

create index if not exists opportunity_drafts_opportunity_idx
  on growth.opportunity_drafts (opportunity_id)
  where opportunity_id is not null;

create unique index if not exists opportunity_drafts_lead_converted_unique
  on growth.opportunity_drafts (lead_id)
  where status = 'converted';

create table if not exists growth.opportunity_approval_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  execution_id uuid not null,
  opportunity_draft_id uuid references growth.opportunity_drafts (id) on delete set null,
  opportunity_id uuid references growth.opportunities (id) on delete set null,
  status text not null default 'completed'
    check (status in ('completed', 'failed', 'partial', 'skipped')),

  opportunity_created boolean not null default false,
  draft_status text,
  attribution_chain jsonb not null default '[]'::jsonb,
  blockers jsonb not null default '[]'::jsonb,

  auto_created boolean not null default false,
  human_confirmed boolean not null default true,
  operator_required boolean not null default true,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists opportunity_approval_runs_execution_idx
  on growth.opportunity_approval_runs (execution_id, created_at desc);

grant select, insert, update, delete on growth.opportunity_approval_runs to service_role;

alter table growth.opportunity_approval_runs enable row level security;

comment on table growth.opportunity_approval_runs is
  'Opportunity Approval Engine (M1-E) — human-confirmed draft to opportunity conversion telemetry.';
