-- GE-AUTO-2B — Event-driven objective runtime subscriptions + observability fields

alter table growth.organization_growth_objectives
  add column if not exists event_subscriptions jsonb not null default '{}'::jsonb;

comment on column growth.organization_growth_objectives.event_subscriptions is
  'GE-AUTO-2B — persisted resource subscriptions for objective event fan-in.';
