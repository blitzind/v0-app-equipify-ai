-- GE-AI-2I-PROD-1 — Persistent bounded autonomous outbound scopes.
-- Organization-scoped, audited, service-role only — NOT Core mutations.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.autonomous_outbound_scopes
-- -----------------------------------------------------------------------------

create table if not exists growth.autonomous_outbound_scopes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  source text not null
    check (source in (
      'objective',
      'campaign',
      'sequence',
      'outreach_package',
      'execution_plan',
      'human_approval_center'
    )),
  source_id text not null,

  status text not null default 'draft'
    check (status in ('draft', 'approved', 'active', 'paused', 'expired', 'completed', 'blocked')),

  approved_by_user_id uuid,
  approved_at timestamptz,
  activated_at timestamptz,
  paused_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null,

  title text not null,
  summary text not null default '',

  allowed_channels text[] not null default '{}'::text[],
  audience jsonb not null default '{}'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  required_checks jsonb not null default '{}'::jsonb,
  stop_conditions jsonb not null default '{}'::jsonb,
  policy jsonb not null default '{}'::jsonb,

  voice_drop_certified boolean not null default false,
  ai_voice_explicitly_approved boolean not null default false,
  blocked_reason text,

  audit_metadata jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-ge-ai-2i-bounded-autonomous-outbound-v1',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists autonomous_outbound_scopes_org_status_idx
  on growth.autonomous_outbound_scopes (organization_id, status, updated_at desc);

create index if not exists autonomous_outbound_scopes_org_source_idx
  on growth.autonomous_outbound_scopes (organization_id, source, source_id);

create index if not exists autonomous_outbound_scopes_org_expires_idx
  on growth.autonomous_outbound_scopes (organization_id, expires_at);

comment on table growth.autonomous_outbound_scopes is
  'GE-AI-2I-PROD-1 bounded autonomous outbound scope — human-approved execution envelope.';

-- -----------------------------------------------------------------------------
-- growth.autonomous_outbound_scope_actions
-- -----------------------------------------------------------------------------

create table if not exists growth.autonomous_outbound_scope_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  scope_id uuid not null references growth.autonomous_outbound_scopes (id) on delete cascade,

  lead_id uuid,
  channel text not null,
  action_type text not null,
  status text not null default 'selected'
    check (status in ('selected', 'blocked', 'queued', 'completed', 'failed', 'skipped')),

  sequence_job_id uuid,
  transport_path text not null default '',
  transport_reference text,
  blocked_gate text,
  blocked_reason text,
  correlation_id uuid not null,
  idempotency_key text,

  selected_at timestamptz,
  queued_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,

  audit_metadata jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-ge-ai-2i-bounded-autonomous-outbound-v1',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists autonomous_outbound_scope_actions_scope_idx
  on growth.autonomous_outbound_scope_actions (scope_id, created_at desc);

create index if not exists autonomous_outbound_scope_actions_org_created_idx
  on growth.autonomous_outbound_scope_actions (organization_id, created_at desc);

create unique index if not exists autonomous_outbound_scope_actions_idempotency_uidx
  on growth.autonomous_outbound_scope_actions (organization_id, idempotency_key)
  where idempotency_key is not null and idempotency_key <> '';

comment on table growth.autonomous_outbound_scope_actions is
  'GE-AI-2I-PROD-1 bounded outbound action ledger — idempotent per organization.';

-- -----------------------------------------------------------------------------
-- growth.autonomous_outbound_scope_events
-- -----------------------------------------------------------------------------

create table if not exists growth.autonomous_outbound_scope_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  scope_id uuid not null references growth.autonomous_outbound_scopes (id) on delete cascade,
  action_id uuid references growth.autonomous_outbound_scope_actions (id) on delete set null,

  event_type text not null,
  payload jsonb not null default '{}'::jsonb,

  qa_marker text not null default 'growth-ge-ai-2i-bounded-autonomous-outbound-v1',
  created_at timestamptz not null default now()
);

create index if not exists autonomous_outbound_scope_events_scope_idx
  on growth.autonomous_outbound_scope_events (scope_id, created_at desc);

create index if not exists autonomous_outbound_scope_events_org_type_idx
  on growth.autonomous_outbound_scope_events (organization_id, event_type, created_at desc);

comment on table growth.autonomous_outbound_scope_events is
  'GE-AI-2I-PROD-1 append-only scope lifecycle audit — complements AI OS event bus.';

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------

drop trigger if exists trg_growth_autonomous_outbound_scopes_updated_at on growth.autonomous_outbound_scopes;
create trigger trg_growth_autonomous_outbound_scopes_updated_at
  before update on growth.autonomous_outbound_scopes
  for each row execute function public.set_updated_at();

drop trigger if exists trg_growth_autonomous_outbound_scope_actions_updated_at on growth.autonomous_outbound_scope_actions;
create trigger trg_growth_autonomous_outbound_scope_actions_updated_at
  before update on growth.autonomous_outbound_scope_actions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — service_role only (Growth Engine server pattern)
-- -----------------------------------------------------------------------------

revoke all on table growth.autonomous_outbound_scopes from public, anon, authenticated;
revoke all on table growth.autonomous_outbound_scope_actions from public, anon, authenticated;
revoke all on table growth.autonomous_outbound_scope_events from public, anon, authenticated;

grant select, insert, update, delete on table growth.autonomous_outbound_scopes to service_role;
grant select, insert, update, delete on table growth.autonomous_outbound_scope_actions to service_role;
grant select, insert on table growth.autonomous_outbound_scope_events to service_role;

alter table growth.autonomous_outbound_scopes enable row level security;
alter table growth.autonomous_outbound_scopes force row level security;

alter table growth.autonomous_outbound_scope_actions enable row level security;
alter table growth.autonomous_outbound_scope_actions force row level security;

alter table growth.autonomous_outbound_scope_events enable row level security;
alter table growth.autonomous_outbound_scope_events force row level security;

drop policy if exists growth_autonomous_outbound_scopes_service_role on growth.autonomous_outbound_scopes;
create policy growth_autonomous_outbound_scopes_service_role
  on growth.autonomous_outbound_scopes for all to service_role using (true) with check (true);

drop policy if exists growth_autonomous_outbound_scope_actions_service_role on growth.autonomous_outbound_scope_actions;
create policy growth_autonomous_outbound_scope_actions_service_role
  on growth.autonomous_outbound_scope_actions for all to service_role using (true) with check (true);

drop policy if exists growth_autonomous_outbound_scope_events_service_role on growth.autonomous_outbound_scope_events;
create policy growth_autonomous_outbound_scope_events_service_role
  on growth.autonomous_outbound_scope_events for all to service_role using (true) with check (true);
