-- Customer signature image stored in `work-order-attachments`; path kept on work_orders for display/signed URLs.

alter table public.work_orders
  add column if not exists signature_url text,
  add column if not exists signature_captured_at timestamptz;

comment on column public.work_orders.signature_url is
  'Object path in `work-order-attachments` bucket (not a public HTTP URL).';

comment on column public.work_orders.signature_captured_at is
  'When the customer signature image was captured.';
