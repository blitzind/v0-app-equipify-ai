-- GE-AIOS-3A — LLM Provider Abstraction (Equipify AI OS).
-- Constitutional reference: AI Revenue Operator Constitution v1.0 — provider governance layer.
-- Provider-agnostic AI interface — delegates to existing Core adapters, no duplicate SDK clients.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regclass('growth.ai_context_packages') is null then
    raise exception 'Missing dependency: growth.ai_context_packages — apply GE-AIOS-2J migration first';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.ai_provider_runtime — org-level provider health / degraded flags
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_provider_runtime (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations (id) on delete cascade,

  degraded boolean not null default false,
  degraded_reason text,
  active_provider text,
  request_count int not null default 0 check (request_count >= 0),
  failure_count int not null default 0 check (failure_count >= 0),
  failover_count int not null default 0 check (failover_count >= 0),

  last_request_at timestamptz,
  last_success_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-aios-3a-provider-adapters-v1',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table growth.ai_provider_runtime is
  'GE-AIOS-3A AI OS provider runtime — health counters and active provider selection.';

-- -----------------------------------------------------------------------------
-- growth.ai_provider_requests — append-only provider invocation audit
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_provider_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  mission_id uuid,
  work_order_id uuid references growth.ai_work_orders (id) on delete set null,
  context_package_id uuid references growth.ai_context_packages (id) on delete set null,

  purpose text not null,
  provider_id text not null,
  model_id text not null,
  request_status text not null default 'pending'
    check (request_status in ('pending', 'completed', 'failed')),

  failover_count int not null default 0 check (failover_count >= 0),
  attempted_providers jsonb not null default '[]'::jsonb,
  normalized_response jsonb,
  error_detail text,

  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  estimated_cost_usd numeric not null default 0,

  qa_marker text not null default 'growth-aios-3a-provider-adapters-v1',
  created_at timestamptz not null default now()
);

create index if not exists ai_provider_requests_work_order_idx
  on growth.ai_provider_requests (organization_id, work_order_id, created_at desc);

create index if not exists ai_provider_requests_context_package_idx
  on growth.ai_provider_requests (organization_id, context_package_id, created_at desc);

comment on table growth.ai_provider_requests is
  'GE-AIOS-3A provider request audit — Context Package in, normalized response out.';

drop trigger if exists trg_growth_ai_provider_runtime_updated_at
  on growth.ai_provider_runtime;
create trigger trg_growth_ai_provider_runtime_updated_at
  before update on growth.ai_provider_runtime
  for each row execute function public.set_updated_at();

revoke all on table growth.ai_provider_runtime from public, anon, authenticated;
revoke all on table growth.ai_provider_requests from public, anon, authenticated;

grant select, insert, update on table growth.ai_provider_runtime to service_role;
grant select, insert on table growth.ai_provider_requests to service_role;

alter table growth.ai_provider_runtime enable row level security;
alter table growth.ai_provider_runtime force row level security;
alter table growth.ai_provider_requests enable row level security;
alter table growth.ai_provider_requests force row level security;

drop policy if exists ai_provider_runtime_service_role on growth.ai_provider_runtime;
create policy ai_provider_runtime_service_role
  on growth.ai_provider_runtime for all to service_role using (true) with check (true);

drop policy if exists ai_provider_requests_service_role on growth.ai_provider_requests;
create policy ai_provider_requests_service_role
  on growth.ai_provider_requests for all to service_role using (true) with check (true);
