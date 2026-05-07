-- Phase 2: import strategy, counts, committed_by, row status "updated".

alter table public.organization_import_jobs
  add column if not exists skipped_count integer not null default 0,
  add column if not exists updated_count integer not null default 0,
  add column if not exists strategy text,
  add column if not exists committed_by uuid references auth.users (id) on delete set null;

comment on column public.organization_import_jobs.skipped_count is
  'Rows skipped (duplicates, create_new_only conflicts, etc.).';

comment on column public.organization_import_jobs.updated_count is
  'Existing records updated per merge strategy.';

comment on column public.organization_import_jobs.strategy is
  'Import merge strategy at commit: skip_duplicates | update_empty_fields | update_existing | create_new_only.';

comment on column public.organization_import_jobs.committed_by is
  'User who ran commit (may differ from created_by for draft uploads).';

-- Relax row status enum: add "updated".
alter table public.organization_import_job_rows
  drop constraint if exists organization_import_job_rows_status_check;

alter table public.organization_import_job_rows
  add constraint organization_import_job_rows_status_check
  check (
    status in (
      'pending',
      'imported',
      'updated',
      'skipped',
      'error',
      'duplicate'
    )
  );
