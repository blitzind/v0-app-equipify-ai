-- GE-AIOS-2H — Decision Engine foundation (Equipify AI OS).
-- Constitutional reference: AI Revenue Operator Constitution v1.0 §7, §11.6, §13.
-- Rule-based evaluation producing Decision Records — NOT LLMs, providers, or execution.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regclass('growth.ai_work_orders') is null then
    raise exception 'Missing dependency: growth.ai_work_orders — apply GE-AIOS-2A migration first';
  end if;
  if to_regclass('growth.ai_decision_records') is null then
    raise exception 'Missing dependency: growth.ai_decision_records — apply GE-AIOS-2D migration first';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.ai_decision_engine_runtime — org-level engine health / degraded flag
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_decision_engine_runtime (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations (id) on delete cascade,

  degraded boolean not null default false,
  degraded_reason text,
  evaluation_count int not null default 0 check (evaluation_count >= 0),
  insufficient_evidence_count int not null default 0 check (insufficient_evidence_count >= 0),

  last_evaluation_at timestamptz,
  last_success_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-aios-2h-decision-engine-v1',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table growth.ai_decision_engine_runtime is
  'GE-AIOS-2H Decision Engine runtime state — degraded mode per Constitution §11.6.';

-- -----------------------------------------------------------------------------
-- growth.ai_decision_engine_requests — append-only evaluation request audit
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_decision_engine_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  mission_id uuid not null,
  work_order_id uuid not null references growth.ai_work_orders (id) on delete cascade,

  decision_key text not null,
  request_status text not null default 'pending'
    check (request_status in ('pending', 'evaluated', 'insufficient_evidence', 'failed')),

  evidence_bundle jsonb not null default '[]'::jsonb,
  evaluation jsonb not null default '{}'::jsonb,
  recommendation jsonb not null default '{}'::jsonb,

  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 100),
  risk_score numeric not null default 0 check (risk_score >= 0 and risk_score <= 100),
  expected_cost_usd numeric not null default 0,

  decision_record_id uuid references growth.ai_decision_records (id) on delete set null,
  degraded_mode boolean not null default false,

  qa_marker text not null default 'growth-aios-2h-decision-engine-v1',
  created_at timestamptz not null default now()
);

create index if not exists ai_decision_engine_requests_work_order_idx
  on growth.ai_decision_engine_requests (organization_id, work_order_id, created_at desc);

create index if not exists ai_decision_engine_requests_mission_idx
  on growth.ai_decision_engine_requests (organization_id, mission_id, created_at desc);

comment on table growth.ai_decision_engine_requests is
  'GE-AIOS-2H Decision Engine request audit — rule evaluation inputs and outcomes.';

drop trigger if exists trg_growth_ai_decision_engine_runtime_updated_at
  on growth.ai_decision_engine_runtime;
create trigger trg_growth_ai_decision_engine_runtime_updated_at
  before update on growth.ai_decision_engine_runtime
  for each row execute function public.set_updated_at();

revoke all on table growth.ai_decision_engine_runtime from public, anon, authenticated;
revoke all on table growth.ai_decision_engine_requests from public, anon, authenticated;

grant select, insert, update on table growth.ai_decision_engine_runtime to service_role;
grant select, insert on table growth.ai_decision_engine_requests to service_role;

alter table growth.ai_decision_engine_runtime enable row level security;
alter table growth.ai_decision_engine_runtime force row level security;
alter table growth.ai_decision_engine_requests enable row level security;
alter table growth.ai_decision_engine_requests force row level security;

drop policy if exists ai_decision_engine_runtime_service_role on growth.ai_decision_engine_runtime;
create policy ai_decision_engine_runtime_service_role
  on growth.ai_decision_engine_runtime for all to service_role using (true) with check (true);

drop policy if exists ai_decision_engine_requests_service_role on growth.ai_decision_engine_requests;
create policy ai_decision_engine_requests_service_role
  on growth.ai_decision_engine_requests for all to service_role using (true) with check (true);
