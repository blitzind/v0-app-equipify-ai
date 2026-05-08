-- Migration Center + QuickBooks — Phase 8 historical import metadata.
--
-- Additive metadata only. The existing QuickBooks OAuth/export sync and mapping
-- tables remain the source of truth for integrations.

alter table public.external_sync_mappings
  add column if not exists imported_at timestamptz,
  add column if not exists import_job_id uuid references public.organization_import_jobs (id) on delete set null,
  add column if not exists mapping_status text,
  add column if not exists mapping_confidence numeric(5, 4);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'external_sync_mappings_mapping_status_check'
      and conrelid = 'public.external_sync_mappings'::regclass
  ) then
    alter table public.external_sync_mappings
      add constraint external_sync_mappings_mapping_status_check
      check (
        mapping_status is null or
        mapping_status in ('matched', 'created', 'updated', 'skipped', 'error')
      );
  end if;
end;
$$;

create index if not exists idx_external_sync_mappings_import_job
  on public.external_sync_mappings (organization_id, import_job_id)
  where import_job_id is not null;

comment on column public.external_sync_mappings.imported_at is
  'When this mapping was created or confirmed by historical QuickBooks import.';
comment on column public.external_sync_mappings.import_job_id is
  'Migration Center import job that created or confirmed this mapping.';
comment on column public.external_sync_mappings.mapping_status is
  'Historical import mapping status: matched, created, updated, skipped, or error.';
comment on column public.external_sync_mappings.mapping_confidence is
  'Heuristic confidence used during QuickBooks historical import preview/commit.';
