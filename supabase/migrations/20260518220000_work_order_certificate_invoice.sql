-- Work order status: completed_pending_signature (done work; awaiting customer signature).
-- Invoice link to calibration certificate record.

alter table public.work_orders drop constraint if exists work_orders_status_check;

alter table public.work_orders
  add constraint work_orders_status_check
  check (
    status in (
      'open',
      'scheduled',
      'in_progress',
      'completed',
      'completed_pending_signature',
      'invoiced'
    )
  );

comment on column public.work_orders.status is
  'open | scheduled | in_progress | completed | completed_pending_signature | invoiced';

alter table public.org_invoices
  add column if not exists calibration_record_id uuid references public.calibration_records (id) on delete set null;

create index if not exists idx_org_invoices_org_calibration_record
  on public.org_invoices (organization_id, calibration_record_id)
  where calibration_record_id is not null;

comment on column public.org_invoices.calibration_record_id is
  'Optional link to the calibration certificate record completed for the related work order.';
