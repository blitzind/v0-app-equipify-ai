-- Async AI work queue (catalog extraction, future certificate flows). Mutations use service role from API routes.

create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid not null,
  task text not null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  input_json jsonb not null default '{}'::jsonb,
  result_json jsonb,
  error_message text,
  progress_percent integer not null default 0
    check (progress_percent >= 0 and progress_percent <= 100),
  current_step text,
  source_type text,
  source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

comment on table public.ai_jobs is
  'Long-running AI tasks; status/progress for polling. Writes from application service role.';

create index if not exists idx_ai_jobs_org_created
  on public.ai_jobs (organization_id, created_at desc);

create index if not exists idx_ai_jobs_org_status
  on public.ai_jobs (organization_id, status);

create index if not exists idx_ai_jobs_source
  on public.ai_jobs (organization_id, source_type, source_id)
  where source_type is not null and source_id is not null;

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_ai_jobs_set_updated_at on public.ai_jobs;
    create trigger trg_ai_jobs_set_updated_at
      before update on public.ai_jobs
      for each row execute function public.set_updated_at();
  end if;
end
$$;

revoke all on table public.ai_jobs from public, anon;
grant select on table public.ai_jobs to authenticated;

alter table public.ai_jobs enable row level security;
alter table public.ai_jobs force row level security;

drop policy if exists "ai_jobs_select_member" on public.ai_jobs;
create policy "ai_jobs_select_member"
on public.ai_jobs
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "ai_jobs_insert_managers" on public.ai_jobs;
create policy "ai_jobs_insert_managers"
on public.ai_jobs
for insert
to authenticated
with check (
  public.has_org_role (organization_id, array['owner', 'admin', 'manager'])
  and created_by = auth.uid ()
);

drop policy if exists "ai_jobs_update_cancel" on public.ai_jobs;
create policy "ai_jobs_update_cancel"
on public.ai_jobs
for update
to authenticated
using (
  public.has_org_role (organization_id, array['owner', 'admin', 'manager'])
  and status in ('queued', 'processing')
)
with check (
  public.has_org_role (organization_id, array['owner', 'admin', 'manager'])
  and status = 'cancelled'
);
