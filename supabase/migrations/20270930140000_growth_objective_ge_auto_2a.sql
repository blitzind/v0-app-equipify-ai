-- GE-AUTO-2A — Objective runtime state and execution history columns.

do $$
begin
  if to_regclass('growth.organization_growth_objectives') is null then
    raise exception 'Missing dependency: growth.organization_growth_objectives';
  end if;
end;
$$;

alter table growth.organization_growth_objectives
  add column if not exists runtime_state jsonb not null default '{}'::jsonb,
  add column if not exists execution_history jsonb not null default '[]'::jsonb,
  add column if not exists recent_signals jsonb not null default '[]'::jsonb;

comment on column growth.organization_growth_objectives.runtime_state is
  'GE-AUTO-2A closed-loop runtime — current stage, stage states, estimated completion.';

comment on column growth.organization_growth_objectives.execution_history is
  'GE-AUTO-2A auditable execution history — policy-gated stage actions.';

comment on column growth.organization_growth_objectives.recent_signals is
  'GE-AUTO-2A recent inbound signals for adaptive loop.';
