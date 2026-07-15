-- GE-AIOS-SCHEDULER-RUNTIME-OPTIMIZATION-1A — Indexed scheduler eligibility columns.
-- Ordinary stored columns synchronized from runtime_state via trigger (generated timestamptz casts are not immutable).

do $$
begin
  if to_regclass('growth.organization_growth_objectives') is null then
    raise exception 'Missing dependency: growth.organization_growth_objectives';
  end if;
end;
$$;

-- Remove helpers from any failed generated-column attempt (safe if absent).
drop function if exists growth.scheduler_wake_at_from_state(jsonb);
drop function if exists growth.scheduler_runtime_running_from_state(jsonb);
drop function if exists growth.immutable_parse_runtime_iso8601_utc(text);

create or replace function growth.try_parse_runtime_timestamptz(value text)
returns timestamptz
language plpgsql
stable
as $$
begin
  if value is null or btrim(value) = '' then
    return null;
  end if;

  begin
    return value::timestamptz;
  exception
    when others then
      return null;
  end;
end;
$$;

comment on function growth.try_parse_runtime_timestamptz(text) is
  'GE-AIOS-SCHEDULER-RUNTIME-OPTIMIZATION-1A — tolerant runtime_state timestamp parser; malformed values return null.';

create or replace function growth.sync_organization_growth_objective_scheduler_eligibility()
returns trigger
language plpgsql
as $$
begin
  if new.runtime_state is null then
    new.scheduler_runtime_running := false;
    new.scheduler_wake_at := '1970-01-01 00:00:00+00'::timestamptz;
    return new;
  end if;

  new.scheduler_runtime_running := coalesce(new.runtime_state ->> 'running', '') = 'true';
  new.scheduler_wake_at := coalesce(
    growth.try_parse_runtime_timestamptz(new.runtime_state ->> 'lastSchedulerAt'),
    growth.try_parse_runtime_timestamptz(new.runtime_state ->> 'lastTickAt'),
    growth.try_parse_runtime_timestamptz(new.runtime_state ->> 'startedAt'),
    '1970-01-01 00:00:00+00'::timestamptz
  );

  return new;
end;
$$;

comment on function growth.sync_organization_growth_objective_scheduler_eligibility() is
  'GE-AIOS-SCHEDULER-RUNTIME-OPTIMIZATION-1A — derives scheduler_runtime_running and scheduler_wake_at from runtime_state.';

alter table growth.organization_growth_objectives
  add column if not exists scheduler_runtime_running boolean not null default false,
  add column if not exists scheduler_wake_at timestamptz;

drop trigger if exists trg_organization_growth_objectives_sync_scheduler_eligibility
  on growth.organization_growth_objectives;

create trigger trg_organization_growth_objectives_sync_scheduler_eligibility
  before insert or update of runtime_state
  on growth.organization_growth_objectives
  for each row
  execute function growth.sync_organization_growth_objective_scheduler_eligibility();

comment on column growth.organization_growth_objectives.scheduler_runtime_running is
  'GE-AIOS-SCHEDULER-RUNTIME-OPTIMIZATION-1A — synchronized from runtime_state.running for indexed scheduler fetch.';

comment on column growth.organization_growth_objectives.scheduler_wake_at is
  'GE-AIOS-SCHEDULER-RUNTIME-OPTIMIZATION-1A — synchronized scheduler wake ordering timestamp.';

-- Backfill existing rows through the canonical trigger path.
update growth.organization_growth_objectives
set runtime_state = runtime_state
where runtime_state is not null;

update growth.organization_growth_objectives
set
  scheduler_runtime_running = false,
  scheduler_wake_at = '1970-01-01 00:00:00+00'::timestamptz
where runtime_state is null;

create index if not exists idx_growth_objectives_scheduler_eligible_wake
  on growth.organization_growth_objectives (scheduler_wake_at asc, id asc)
  where status = 'active'
    and emergency_stop_active = false
    and scheduler_runtime_running = true;
