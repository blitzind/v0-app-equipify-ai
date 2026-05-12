-- Org-level approval policy knobs for AIden prepared workspace actions (confirm/execute gates).

do $migration$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regprocedure('public.is_org_member(uuid)') is null then
    raise exception 'Missing dependency: public.is_org_member(uuid)';
  end if;
end
$migration$;

create table if not exists public.aiden_org_approval_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  allow_financial_aiden_actions boolean not null default true,
  require_owner_approval_for_bulk_financial_actions boolean not null default false,
  max_bulk_action_count integer null,
  max_financial_action_amount_without_owner_approval numeric(14, 2) null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint aiden_org_approval_settings_max_bulk_check check (
    max_bulk_action_count is null or (max_bulk_action_count >= 1 and max_bulk_action_count <= 500)
  ),
  constraint aiden_org_approval_settings_max_amount_check check (
    max_financial_action_amount_without_owner_approval is null
    or max_financial_action_amount_without_owner_approval >= 0::numeric
  )
);

comment on table public.aiden_org_approval_settings is
  'Workspace policy for AIden prepared financial/bulk actions. Rows optional — app applies defaults when missing.';

create index if not exists idx_aiden_org_approval_settings_org on public.aiden_org_approval_settings (organization_id);

alter table public.aiden_org_approval_settings enable row level security;

drop policy if exists "aiden_org_approval_settings_select_org_member" on public.aiden_org_approval_settings;
create policy "aiden_org_approval_settings_select_org_member"
on public.aiden_org_approval_settings
for select
to authenticated
using (public.is_org_member (organization_id));

revoke all on table public.aiden_org_approval_settings from public, anon;
grant select on table public.aiden_org_approval_settings to authenticated;

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_aiden_org_approval_settings_set_updated_at on public.aiden_org_approval_settings;
    create trigger trg_aiden_org_approval_settings_set_updated_at
    before update on public.aiden_org_approval_settings
    for each row execute function public.set_updated_at();
  end if;
end $$;

grant select, insert, update, delete on table public.aiden_org_approval_settings to service_role;
