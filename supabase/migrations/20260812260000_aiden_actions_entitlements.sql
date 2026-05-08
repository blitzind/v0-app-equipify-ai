create table if not exists public.organization_feature_overrides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  feature_key text not null,
  enabled boolean not null,
  reason text null,
  updated_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_feature_overrides_feature_key_check
    check (feature_key in ('aiden_actions')),
  constraint organization_feature_overrides_org_feature_unique
    unique (organization_id, feature_key)
);

create index if not exists idx_organization_feature_overrides_org
  on public.organization_feature_overrides (organization_id);

alter table public.organization_feature_overrides enable row level security;

drop policy if exists "organization_feature_overrides_select_org_member" on public.organization_feature_overrides;
create policy "organization_feature_overrides_select_org_member"
on public.organization_feature_overrides
for select
to authenticated
using (public.is_org_member(organization_id));

revoke all on table public.organization_feature_overrides from public, anon;
grant select on table public.organization_feature_overrides to authenticated;

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_organization_feature_overrides_set_updated_at on public.organization_feature_overrides;
    create trigger trg_organization_feature_overrides_set_updated_at
    before update on public.organization_feature_overrides
    for each row execute function public.set_updated_at();
  end if;
end $$;

create table if not exists public.aiden_action_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid null references auth.users (id) on delete set null,
  action_type text not null,
  status text not null default 'proposed',
  request_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint aiden_action_logs_status_check
    check (status in ('proposed', 'confirmed', 'canceled', 'completed', 'failed'))
);

create index if not exists idx_aiden_action_logs_org_created
  on public.aiden_action_logs (organization_id, created_at desc);

create index if not exists idx_aiden_action_logs_type_status
  on public.aiden_action_logs (action_type, status, created_at desc);

alter table public.aiden_action_logs enable row level security;

drop policy if exists "aiden_action_logs_select_org_member" on public.aiden_action_logs;
create policy "aiden_action_logs_select_org_member"
on public.aiden_action_logs
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "aiden_action_logs_insert_org_member" on public.aiden_action_logs;
create policy "aiden_action_logs_insert_org_member"
on public.aiden_action_logs
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and user_id = auth.uid()
);

revoke all on table public.aiden_action_logs from public, anon;
grant select, insert on table public.aiden_action_logs to authenticated;

comment on table public.organization_feature_overrides is
  'Service-role managed feature overrides. Used by platform admins to enable or force-disable capabilities such as AIden Actions.';

comment on table public.aiden_action_logs is
  'Audit log for AIden proposed/confirmed/completed/failed workflow actions.';
