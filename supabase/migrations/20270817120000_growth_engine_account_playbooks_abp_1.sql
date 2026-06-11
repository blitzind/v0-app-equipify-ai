-- Growth Engine Account Playbooks (ABP-1) — account-centric orchestration queue.
-- No outreach, calls, SMS, email, or sequence drafts.

do $$
begin
  if to_regclass('growth.apollo_enrollment_candidates') is null then
    raise exception 'Missing dependency: growth.apollo_enrollment_candidates';
  end if;
end;
$$;

create table if not exists growth.account_playbooks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  enrollment_candidate_id uuid not null references growth.apollo_enrollment_candidates (id) on delete cascade,
  company_candidate_id uuid not null,
  canonical_company_id uuid,
  company_contact_id uuid references growth.company_contacts (id) on delete set null,
  contact_candidate_id uuid references growth.contact_candidates (id) on delete set null,
  growth_lead_id uuid references growth.leads (id) on delete set null,

  status text not null default 'pending_playbook_approval'
    check (status in (
      'pending_playbook_approval',
      'playbook_approved',
      'playbook_rejected',
      'playbook_rerun_requested'
    )),

  company_name text not null default '',
  playbook_key text not null default '',
  committee_strategy text not null default '',
  recommended_roles jsonb not null default '[]'::jsonb,
  recommended_channels jsonb not null default '[]'::jsonb,
  committee_role_summary jsonb not null default '[]'::jsonb,
  committee_coverage_score numeric(5, 2) not null default 0,
  coverage_status text not null default 'Weak'
    check (coverage_status in ('Weak', 'Partial', 'Strong')),
  recommended_messaging_theme jsonb not null default '{}'::jsonb,
  recommended_channel_mix jsonb not null default '{}'::jsonb,
  confidence_score numeric(5, 2) not null default 0,
  reasoning text not null default '',

  qualification_snapshot jsonb not null default '{}'::jsonb,
  company_profile_snapshot jsonb not null default '{}'::jsonb,
  channel_availability jsonb not null default '{}'::jsonb,
  source_attribution jsonb not null default '{}'::jsonb,

  playbook_approved_at timestamptz,
  playbook_approved_by uuid,
  playbook_approved_email text,
  playbook_rejection_note text,

  outreach_sent boolean not null default false,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists account_playbooks_status_idx
  on growth.account_playbooks (status, created_at desc);

create index if not exists account_playbooks_enrollment_idx
  on growth.account_playbooks (enrollment_candidate_id, created_at desc);

create index if not exists account_playbooks_company_candidate_idx
  on growth.account_playbooks (company_candidate_id, created_at desc);

create unique index if not exists account_playbooks_enrollment_unique
  on growth.account_playbooks (enrollment_candidate_id)
  where status = 'pending_playbook_approval';

create table if not exists growth.account_playbook_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  account_playbook_id uuid not null references growth.account_playbooks (id) on delete cascade,
  full_name text not null default '',
  title text,
  role_category text not null default 'Unknown'
    check (role_category in ('Executive', 'Operations', 'Technical', 'Financial', 'End User', 'Unknown')),
  recommended_messaging_theme jsonb not null default '[]'::jsonb,
  recommended_channel_mix jsonb not null default '[]'::jsonb,
  contactable boolean not null default false,
  is_decision_maker boolean not null default false,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists account_playbook_members_playbook_idx
  on growth.account_playbook_members (account_playbook_id, created_at desc);

create table if not exists growth.account_playbook_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  execution_id uuid not null,
  enrollment_candidate_id uuid,
  account_playbook_id uuid references growth.account_playbooks (id) on delete set null,
  status text not null default 'completed'
    check (status in ('completed', 'failed', 'partial')),

  playbooks_created integer not null default 0,
  playbooks_skipped_duplicate integer not null default 0,
  funnel_metrics jsonb not null default '{}'::jsonb,
  blockers jsonb not null default '[]'::jsonb,

  outreach_sent boolean not null default false,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists account_playbook_runs_execution_idx
  on growth.account_playbook_runs (execution_id, created_at desc);

alter table growth.apollo_voice_drop_candidates
  add column if not exists account_playbook_id uuid references growth.account_playbooks (id) on delete set null;

create index if not exists apollo_voice_drop_candidates_account_playbook_idx
  on growth.apollo_voice_drop_candidates (account_playbook_id, created_at desc);

revoke all on table growth.account_playbooks from public, anon, authenticated;
grant select, insert, update, delete on table growth.account_playbooks to service_role;
alter table growth.account_playbooks enable row level security;

revoke all on table growth.account_playbook_members from public, anon, authenticated;
grant select, insert, update, delete on table growth.account_playbook_members to service_role;
alter table growth.account_playbook_members enable row level security;

revoke all on table growth.account_playbook_runs from public, anon, authenticated;
grant select, insert, update, delete on table growth.account_playbook_runs to service_role;
alter table growth.account_playbook_runs enable row level security;

comment on table growth.account_playbooks is
  'Account Playbook Ready queue. Generated from enrollment-approved candidates — account-centric orchestration without live outreach.';

comment on table growth.account_playbook_members is
  'Buying committee members attached to account playbooks with role classification and touch strategy.';

comment on table growth.account_playbook_runs is
  'Account playbook automation run telemetry — intelligence generation only, no outreach side effects.';
