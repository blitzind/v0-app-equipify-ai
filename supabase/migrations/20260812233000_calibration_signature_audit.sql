-- Phase 17: lightweight technician signature audit metadata for generated certificates.

alter table public.calibration_records
  add column if not exists technician_signature_source text,
  add column if not exists technician_signature_technician_id uuid references public.technicians (id) on delete set null,
  add column if not exists technician_signature_generated_at timestamptz,
  add column if not exists technician_signature_fallback_used boolean not null default false;

alter table public.calibration_records
  drop constraint if exists calibration_records_technician_signature_source_check;

alter table public.calibration_records
  add constraint calibration_records_technician_signature_source_check
  check (
    technician_signature_source is null or technician_signature_source in (
      'fresh_capture',
      'stored_profile',
      'generated_label',
      'unsigned'
    )
  );

create index if not exists idx_calibration_records_org_signature_source
  on public.calibration_records (organization_id, technician_signature_source, technician_signature_generated_at desc);

comment on column public.calibration_records.technician_signature_source is
  'Signature source used when the calibration certificate record was generated: fresh_capture | stored_profile | generated_label | unsigned.';
comment on column public.calibration_records.technician_signature_technician_id is
  'Technician whose signature context was used for this generated certificate, when available.';
comment on column public.calibration_records.technician_signature_generated_at is
  'Timestamp when signature source metadata was captured for this generated certificate.';
comment on column public.calibration_records.technician_signature_fallback_used is
  'True when generated certificate used stored signature, generated label, or unsigned fallback instead of a fresh visit signature.';
