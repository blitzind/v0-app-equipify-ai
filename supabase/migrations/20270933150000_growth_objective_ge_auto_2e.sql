-- GE-AUTO-2E — Objective execution context for materialized resources & recovery.

alter table growth.organization_growth_objectives
  add column if not exists execution_context jsonb not null default '{}'::jsonb;

comment on column growth.organization_growth_objectives.execution_context is
  'GE-AUTO-2E — persisted materialized resources (searches, audiences, assets, launches) for runtime recovery.';
