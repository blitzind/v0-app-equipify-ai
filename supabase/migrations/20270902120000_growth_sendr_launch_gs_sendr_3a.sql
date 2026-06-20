-- GS-SENDR-3A — Operator launch wizard audit trail (resumable chunks, no workers).

create table if not exists growth.growth_sendr_launch_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  audience_id uuid not null,
  sequence_pattern_id uuid not null,
  landing_page_id uuid not null references growth.growth_landing_pages (id) on delete restrict,
  preview_id uuid,
  enrollment_run_id uuid,
  sequence_link_id uuid references growth.growth_sendr_sequence_page_links (id) on delete set null,
  status text not null default 'pending'
    check (status in (
      'pending',
      'previewing',
      'ready_to_enroll',
      'enrolling',
      'completed',
      'failed',
      'cancelled'
    )),
  requested_count integer not null default 0,
  enrolled_count integer not null default 0,
  processed_count integer not null default 0,
  remaining_count integer not null default 0,
  cursor jsonb not null default '{}'::jsonb,
  last_step text,
  last_error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-sendr-launch-gs-sendr-3a-v1',
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_sendr_launch_runs_org_started
  on growth.growth_sendr_launch_runs (organization_id, started_at desc);

create index if not exists idx_growth_sendr_launch_runs_audience
  on growth.growth_sendr_launch_runs (audience_id, started_at desc);

create index if not exists idx_growth_sendr_launch_runs_resumable
  on growth.growth_sendr_launch_runs (organization_id, status)
  where status in ('pending', 'previewing', 'ready_to_enroll', 'enrolling');

insert into growth.runtime_guardrail_settings (key, enabled, qa_marker)
values
  ('sendr_launch_enabled', true, 'growth-sendr-launch-gs-sendr-3a-v1'),
  ('sendr_launch_preview_enabled', true, 'growth-sendr-launch-gs-sendr-3a-v1')
on conflict (key) do nothing;

alter table growth.growth_sendr_launch_runs enable row level security;
alter table growth.growth_sendr_launch_runs force row level security;
revoke all on table growth.growth_sendr_launch_runs from public, anon, authenticated;
grant select, insert, update on growth.growth_sendr_launch_runs to service_role;

drop policy if exists growth_sendr_launch_runs_service_role on growth.growth_sendr_launch_runs;
create policy growth_sendr_launch_runs_service_role
  on growth.growth_sendr_launch_runs for all to service_role using (true) with check (true);

comment on table growth.growth_sendr_launch_runs is
  'GS-SENDR-3A operator launch wizard runs — chunked preview/enroll, enrollment only, no autonomous sends.';
