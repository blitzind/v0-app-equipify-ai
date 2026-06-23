-- GE-AUTO-1A — Graduated Autonomy Foundation (configuration + kill switch seeds only).
-- No autonomous execution, no autonomous approvals, no behavior changes.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regclass('growth.runtime_guardrail_settings') is null then
    raise exception 'Missing dependency: growth.runtime_guardrail_settings';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.organization_autonomy_settings — org-scoped autonomy configuration
-- -----------------------------------------------------------------------------

create table if not exists growth.organization_autonomy_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  master_mode text not null default 'manual' check (
    master_mode in ('manual', 'assisted', 'guardrailed', 'channel', 'objective')
  ),
  capability_toggles jsonb not null default '{}'::jsonb,
  approval_policies jsonb not null default '{}'::jsonb,
  channel_permissions jsonb not null default '{}'::jsonb,
  daily_budget_limits jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-autonomy-ge-auto-1a-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_organization_autonomy_settings_org
  on growth.organization_autonomy_settings (organization_id);

comment on table growth.organization_autonomy_settings is
  'GE-AUTO-1A org autonomy configuration — defaults preserve manual / approval-required behavior.';

drop trigger if exists trg_growth_organization_autonomy_settings_set_updated_at
  on growth.organization_autonomy_settings;
create trigger trg_growth_organization_autonomy_settings_set_updated_at
before update on growth.organization_autonomy_settings
for each row execute function public.set_updated_at();

revoke all on table growth.organization_autonomy_settings from public, anon, authenticated;
grant select, insert, update, delete on table growth.organization_autonomy_settings to service_role;

alter table growth.organization_autonomy_settings enable row level security;
alter table growth.organization_autonomy_settings force row level security;

drop policy if exists growth_organization_autonomy_settings_service_role
  on growth.organization_autonomy_settings;
create policy growth_organization_autonomy_settings_service_role
  on growth.organization_autonomy_settings for all to service_role using (true) with check (true);

-- -----------------------------------------------------------------------------
-- Autonomy kill switches — default OFF (disabled) unlike feature kill switches
-- -----------------------------------------------------------------------------

insert into growth.runtime_guardrail_settings (key, enabled, qa_marker)
values
  ('autonomy_enabled', false, 'growth-autonomy-ge-auto-1a-v1'),
  ('autonomy_outbound_enabled', false, 'growth-autonomy-ge-auto-1a-v1'),
  ('autonomy_generation_enabled', false, 'growth-autonomy-ge-auto-1a-v1'),
  ('autonomy_objective_mode_enabled', false, 'growth-autonomy-ge-auto-1a-v1')
on conflict (key) do nothing;
