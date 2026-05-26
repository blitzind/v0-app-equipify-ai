-- Growth Engine — Buying Stage Detection Engine (Prompt 21).
-- Candidate buying stage from observable behavior. Not guaranteed truth.

do $$
begin
  if to_regclass('growth.lead_inbox') is null then
    raise exception 'Missing dependency: growth.lead_inbox';
  end if;
end;
$$;

create table if not exists growth.buying_stage_assessments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_inbox_id uuid references growth.lead_inbox (id) on delete set null,
  intent_session_id uuid,
  company_identification_id uuid,
  detected_stage text not null
    check (detected_stage in (
      'awareness',
      'problem_identified',
      'solution_research',
      'vendor_evaluation',
      'comparison',
      'purchase_ready',
      'active_opportunity',
      'existing_customer_expansion',
      'retention_risk'
    )),
  stage_confidence numeric(4, 3) not null default 0 check (stage_confidence >= 0 and stage_confidence <= 1),
  stage_score int not null default 0 check (stage_score >= 0 and stage_score <= 100),
  stage_reasoning jsonb not null default '[]'::jsonb,
  evidence text not null default '',
  source_attribution jsonb not null default '[]'::jsonb,
  signal_summary jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists buying_stage_assessments_inbox_idx
  on growth.buying_stage_assessments (lead_inbox_id, stage_score desc)
  where lead_inbox_id is not null;

create index if not exists buying_stage_assessments_session_idx
  on growth.buying_stage_assessments (intent_session_id, created_at desc)
  where intent_session_id is not null;

create index if not exists buying_stage_assessments_stage_idx
  on growth.buying_stage_assessments (detected_stage, stage_confidence desc);
