-- Allow historical quote CSV import jobs (FieldPulse templates + future commit engine).

alter table public.organization_import_jobs
  drop constraint if exists organization_import_jobs_kind_check;

alter table public.organization_import_jobs
  add constraint organization_import_jobs_kind_check
  check (
    kind in (
      'customer',
      'equipment',
      'invoice',
      'work_order',
      'certificate',
      'quickbooks_snapshot',
      'generic',
      'quote'
    )
  );
