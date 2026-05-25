-- Growth Engine Slice 6.26A — Blitz dogfood hardening + internal revenue validation.

create table if not exists growth.dogfood_validation_runs (
  id uuid primary key default gen_random_uuid(),
  subsystem text not null,
  status text not null,
  notes text not null default '',
  owner_user_id uuid references auth.users (id) on delete set null,
  issue_count int not null default 0 check (issue_count >= 0),
  confidence int not null default 0 check (confidence >= 0 and confidence <= 100),
  qa_marker text not null default 'dogfood-validation-v1',
  run_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table growth.dogfood_validation_runs
  drop constraint if exists dogfood_validation_runs_subsystem_check;

alter table growth.dogfood_validation_runs
  add constraint dogfood_validation_runs_subsystem_check
  check (subsystem in ('import', 'outbound', 'reply', 'meeting', 'pipeline', 'lifecycle'));

alter table growth.dogfood_validation_runs
  drop constraint if exists dogfood_validation_runs_status_check;

alter table growth.dogfood_validation_runs
  add constraint dogfood_validation_runs_status_check
  check (status in ('not_tested', 'testing', 'validated', 'warning', 'failed'));

create index if not exists idx_growth_dogfood_runs_subsystem_run
  on growth.dogfood_validation_runs (subsystem, run_at desc);

create index if not exists idx_growth_dogfood_runs_status
  on growth.dogfood_validation_runs (status, run_at desc);

create table if not exists growth.dogfood_issues (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  severity text not null,
  subsystem text not null,
  owner_user_id uuid references auth.users (id) on delete set null,
  status text not null default 'open',
  reproduction_notes text not null default '',
  fixed_version text,
  qa_marker text not null default 'dogfood-validation-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table growth.dogfood_issues
  drop constraint if exists dogfood_issues_subsystem_check;

alter table growth.dogfood_issues
  add constraint dogfood_issues_subsystem_check
  check (subsystem in ('import', 'outbound', 'reply', 'meeting', 'pipeline', 'lifecycle'));

alter table growth.dogfood_issues
  drop constraint if exists dogfood_issues_severity_check;

alter table growth.dogfood_issues
  add constraint dogfood_issues_severity_check
  check (severity in ('critical', 'high', 'medium', 'low'));

alter table growth.dogfood_issues
  drop constraint if exists dogfood_issues_status_check;

alter table growth.dogfood_issues
  add constraint dogfood_issues_status_check
  check (status in ('open', 'in_progress', 'fixed', 'wont_fix'));

create index if not exists idx_growth_dogfood_issues_subsystem_status
  on growth.dogfood_issues (subsystem, status, severity);

create index if not exists idx_growth_dogfood_issues_open_severity
  on growth.dogfood_issues (severity, updated_at desc)
  where status in ('open', 'in_progress');

revoke all on table growth.dogfood_validation_runs from public, anon, authenticated;
grant select, insert, update on table growth.dogfood_validation_runs to service_role;
alter table growth.dogfood_validation_runs enable row level security;
alter table growth.dogfood_validation_runs force row level security;

revoke all on table growth.dogfood_issues from public, anon, authenticated;
grant select, insert, update on table growth.dogfood_issues to service_role;
alter table growth.dogfood_issues enable row level security;
alter table growth.dogfood_issues force row level security;
