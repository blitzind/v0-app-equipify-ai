-- Phase 3B — Deep operator copilot intelligence (strategy, performance, expanded suggestions).
-- Operator-controlled, evidence-backed. No autonomous customer actions.

do $$
begin
  if to_regclass('voice.voice_ai_copilot_suggestions') is null then
    raise exception 'Missing dependency: voice.voice_ai_copilot_suggestions (apply Phase 3A first)';
  end if;
end;
$$;

-- Extend suggestion type enum (idempotent per value)
do $$
declare
  v text;
  vals text[] := array[
    'objection_strategy',
    'rapport_repair',
    'de_escalation_prompt',
    'pricing_positioning',
    'qualification_gap',
    'close_timing_suggestion',
    'retention_recovery_prompt',
    'expansion_conversation_prompt',
    'operator_pacing_alert',
    'operator_interrupt_alert',
    'compliance_recovery_prompt'
  ];
begin
  foreach v in array vals loop
    if not exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'voice' and t.typname = 'voice_ai_copilot_suggestion_type' and e.enumlabel = v
    ) then
      execute format('alter type voice.voice_ai_copilot_suggestion_type add value %L', v);
    end if;
  end loop;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_conversation_phase'
  ) then
    create type voice.voice_conversation_phase as enum (
      'introduction',
      'discovery',
      'qualification',
      'objection_handling',
      'pricing_discussion',
      'booking_attempt',
      'escalation_risk',
      'close_attempt',
      'follow_up_scheduling',
      'retention_recovery'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_operator_performance_insight_type'
  ) then
    create type voice.voice_operator_performance_insight_type as enum (
      'talk_ratio_trend',
      'interruption_trend',
      'objection_recovery',
      'escalation_avoidance',
      'booking_assistance',
      'follow_up_adherence',
      'sentiment_recovery',
      'pacing_consistency'
    );
  end if;
end;
$$;

create table if not exists voice.voice_operator_performance_insights (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  voice_call_id uuid not null references voice.voice_calls (id) on delete cascade,
  operator_user_id uuid,
  insight_type voice.voice_operator_performance_insight_type not null,
  metric_value numeric(8,4),
  evidence_text text not null,
  confidence_score numeric(5,4) not null check (confidence_score >= 0 and confidence_score <= 1),
  coaching_prompt text,
  created_at timestamptz not null default now()
);

comment on table voice.voice_operator_performance_insights is
  'Assistive operator coaching insights — internal-only, non-punitive. Evidence-linked.';

create index if not exists idx_voice_operator_performance_insights_org_call
  on voice.voice_operator_performance_insights (organization_id, voice_call_id, created_at desc);

create index if not exists idx_voice_operator_performance_insights_operator
  on voice.voice_operator_performance_insights (organization_id, operator_user_id, created_at desc)
  where operator_user_id is not null;

alter table voice.voice_operator_performance_insights enable row level security;

create policy voice_operator_performance_insights_select on voice.voice_operator_performance_insights
  for select to authenticated
  using (
    organization_id in (
      select om.organization_id from public.organization_members om where om.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on voice.voice_operator_performance_insights to service_role;
