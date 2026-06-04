-- Growth Engine Phase 4.6 — Outreach performance intelligence attribution store.

do $$
begin
  if to_regclass('growth.ai_copilot_generations') is null then
    raise exception 'Missing dependency: growth.ai_copilot_generations';
  end if;
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

create table if not exists growth.outreach_performance_attributions (
  attribution_id text primary key,
  generation_id uuid references growth.ai_copilot_generations (id) on delete cascade,
  lead_id uuid references growth.leads (id) on delete set null,
  generation_type text not null,
  strategy_version text not null,
  variation_key text not null,
  recorded_at timestamptz not null default now(),
  subject_strategy_key text not null,
  subject_category text not null,
  subject_evidence_source text not null,
  subject_quality_score integer,
  subject_memory_aware boolean not null default false,
  subject_research_backed boolean not null default false,
  opener_strategy_key text not null,
  opener_evidence_source text,
  opener_research_confidence_tier text,
  opener_memory_backed boolean not null default false,
  opener_research_backed boolean not null default false,
  opener_generic boolean not null default false,
  cta_strategy_key text not null,
  cta_category text not null,
  cta_evidence_source text not null,
  cta_quality_score integer,
  context_utilization_pct integer,
  memory_utilization_pct integer,
  research_confidence integer,
  memory_coverage_score integer,
  lead_engine_guidance_used boolean not null default false,
  context_sources_used jsonb not null default '[]'::jsonb,
  memory_signals_used jsonb not null default '[]'::jsonb,
  attribution_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_outreach_performance_attributions_generation
  on growth.outreach_performance_attributions (generation_id)
  where generation_id is not null;

create index if not exists idx_outreach_performance_attributions_recorded
  on growth.outreach_performance_attributions (recorded_at desc);

create index if not exists idx_outreach_performance_attributions_subject_category
  on growth.outreach_performance_attributions (subject_category, recorded_at desc);

create index if not exists idx_outreach_performance_attributions_opener_strategy
  on growth.outreach_performance_attributions (opener_strategy_key, recorded_at desc);

create index if not exists idx_outreach_performance_attributions_cta_category
  on growth.outreach_performance_attributions (cta_category, recorded_at desc);

comment on table growth.outreach_performance_attributions is
  'Stable outreach personalization attribution for performance measurement — no copy generation.';

revoke all on table growth.outreach_performance_attributions from public, anon, authenticated;
grant select, insert, update, delete on table growth.outreach_performance_attributions to service_role;
alter table growth.outreach_performance_attributions enable row level security;
alter table growth.outreach_performance_attributions force row level security;

create policy growth_outreach_performance_attributions_service_role
  on growth.outreach_performance_attributions for all to service_role using (true) with check (true);
