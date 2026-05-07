-- Migration / historical import job tracking (owner & admin only via RLS).

create table if not exists public.organization_import_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  kind text not null
    check (kind in (
      'customer',
      'equipment',
      'invoice',
      'work_order',
      'certificate',
      'quickbooks_snapshot',
      'generic'
    )),
  source_system text,
  status text not null default 'draft'
    check (status in (
      'draft',
      'queued',
      'processing',
      'completed',
      'completed_with_errors',
      'failed',
      'cancelled'
    )),
  file_name text,
  storage_path text,
  column_mapping jsonb not null default '{}'::jsonb,
  options jsonb not null default '{}'::jsonb,
  preview_json jsonb,
  validation_summary jsonb,
  row_count integer not null default 0,
  success_count integer not null default 0,
  error_count integer not null default 0,
  user_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organization_import_jobs is
  'Tenant-scoped data migration batches (CSV preview, validation, commit). Sensitive — owner/admin only.';

create index if not exists idx_organization_import_jobs_org_created
  on public.organization_import_jobs (organization_id, created_at desc);

create table if not exists public.organization_import_job_rows (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null references public.organization_import_jobs (id) on delete cascade,
  row_index integer not null,
  status text not null
    check (status in ('pending', 'imported', 'skipped', 'error', 'duplicate')),
  codes text[] not null default '{}'::text[],
  message text,
  entity_kind text,
  entity_id uuid,
  snapshot jsonb not null default '{}'::jsonb,
  unique (import_job_id, row_index)
);

comment on table public.organization_import_job_rows is
  'Per-row outcomes for an import job (errors, duplicates, linked entity ids for audit).';

create index if not exists idx_organization_import_job_rows_job
  on public.organization_import_job_rows (import_job_id, row_index);

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_organization_import_jobs_set_updated_at on public.organization_import_jobs;
    create trigger trg_organization_import_jobs_set_updated_at
    before update on public.organization_import_jobs
    for each row execute function public.set_updated_at();
  end if;
end
$$;

revoke all on table public.organization_import_jobs from public, anon;
grant select, insert, update, delete on table public.organization_import_jobs to authenticated;

revoke all on table public.organization_import_job_rows from public, anon;
grant select, insert, update, delete on table public.organization_import_job_rows to authenticated;

alter table public.organization_import_jobs enable row level security;
alter table public.organization_import_jobs force row level security;

alter table public.organization_import_job_rows enable row level security;
alter table public.organization_import_job_rows force row level security;

-- Sensitive migration tooling: owner & admin only (not managers).
drop policy if exists "organization_import_jobs_select_admin" on public.organization_import_jobs;
create policy "organization_import_jobs_select_admin"
on public.organization_import_jobs for select to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin']));

drop policy if exists "organization_import_jobs_write_admin" on public.organization_import_jobs;
create policy "organization_import_jobs_write_admin"
on public.organization_import_jobs for all to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin']))
with check (public.has_org_role (organization_id, array['owner', 'admin']));

drop policy if exists "organization_import_job_rows_select_admin" on public.organization_import_job_rows;
create policy "organization_import_job_rows_select_admin"
on public.organization_import_job_rows for select to authenticated
using (
  exists (
    select 1
    from public.organization_import_jobs j
    where j.id = organization_import_job_rows.import_job_id
      and public.has_org_role (j.organization_id, array['owner', 'admin'])
  )
);

drop policy if exists "organization_import_job_rows_write_admin" on public.organization_import_job_rows;
create policy "organization_import_job_rows_write_admin"
on public.organization_import_job_rows for all to authenticated
using (
  exists (
    select 1
    from public.organization_import_jobs j
    where j.id = organization_import_job_rows.import_job_id
      and public.has_org_role (j.organization_id, array['owner', 'admin'])
  )
)
with check (
  exists (
    select 1
    from public.organization_import_jobs j
    where j.id = organization_import_job_rows.import_job_id
      and public.has_org_role (j.organization_id, array['owner', 'admin'])
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-imports',
  'organization-imports',
  false,
  31457280,
  array['text/csv', 'text/plain', 'application/vnd.ms-excel', 'application/csv']::text[]
)
on conflict (id) do nothing;

comment on column public.organization_import_jobs.options is
  'Import options JSON: duplicateStrategy, skipQuickBooksSync, historical flags, etc.';
