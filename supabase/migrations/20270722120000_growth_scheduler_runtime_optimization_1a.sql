-- GE-AIOS-SCHEDULER-RUNTIME-OPTIMIZATION-1A — Indexed scheduler eligibility columns.
-- Smallest safe addition: generated fields + partial index for due running objectives.

do $$
begin
  if to_regclass('growth.organization_growth_objectives') is null then
    raise exception 'Missing dependency: growth.organization_growth_objectives';
  end if;
end;
$$;

alter table growth.organization_growth_objectives
  add column if not exists scheduler_runtime_running boolean
    generated always as (coalesce((runtime_state->>'running')::boolean, false)) stored,
  add column if not exists scheduler_wake_at timestamptz
    generated always as (
      coalesce(
        nullif(runtime_state->>'lastSchedulerAt', '')::timestamptz,
        nullif(runtime_state->>'lastTickAt', '')::timestamptz,
        nullif(runtime_state->>'startedAt', '')::timestamptz,
        '1970-01-01 00:00:00+00'::timestamptz
      )
    ) stored;

comment on column growth.organization_growth_objectives.scheduler_runtime_running is
  'GE-AIOS-SCHEDULER-RUNTIME-OPTIMIZATION-1A — generated from runtime_state.running for indexed scheduler fetch.';

comment on column growth.organization_growth_objectives.scheduler_wake_at is
  'GE-AIOS-SCHEDULER-RUNTIME-OPTIMIZATION-1A — oldest scheduler activity for wake-time ordering.';

create index if not exists idx_growth_objectives_scheduler_eligible_wake
  on growth.organization_growth_objectives (scheduler_wake_at asc, id asc)
  where status = 'active'
    and emergency_stop_active = false
    and scheduler_runtime_running = true;
