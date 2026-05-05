-- Org-scoped internal tasks (e.g. follow-ups from AI insights)

create table if not exists public.org_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  description text not null default '',
  source_type text not null default 'manual',
  source_id text,
  status text not null default 'open',
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint org_tasks_status_check check (status in ('open', 'done', 'dismissed'))
);

create index if not exists idx_org_tasks_org_status
  on public.org_tasks (organization_id, status);

create index if not exists idx_org_tasks_org_created
  on public.org_tasks (organization_id, created_at desc);

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_org_tasks_set_updated_at on public.org_tasks;
    create trigger trg_org_tasks_set_updated_at
    before update on public.org_tasks
    for each row execute function public.set_updated_at();
  end if;
end
$$;

revoke all on table public.org_tasks from public, anon;
grant select, insert, update, delete on table public.org_tasks to authenticated;

alter table public.org_tasks enable row level security;

drop policy if exists "org_tasks_select_member" on public.org_tasks;
create policy "org_tasks_select_member"
on public.org_tasks
for select
to authenticated
using (public.is_org_member(organization_id));

-- Any active member can create a follow-up task; managers+ can update/delete
drop policy if exists "org_tasks_insert_member" on public.org_tasks;
create policy "org_tasks_insert_member"
on public.org_tasks
for insert
to authenticated
with check (public.is_org_member(organization_id));

drop policy if exists "org_tasks_update_roles" on public.org_tasks;
create policy "org_tasks_update_roles"
on public.org_tasks
for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "org_tasks_delete_roles" on public.org_tasks;
create policy "org_tasks_delete_roles"
on public.org_tasks
for delete
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));
