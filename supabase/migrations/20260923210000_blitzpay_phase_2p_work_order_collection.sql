-- BlitzPay Phase 2P — work order field collection + payment plan WO index.

alter table public.work_orders
  add column if not exists blitzpay_field_invoice_later_at timestamptz;

comment on column public.work_orders.blitzpay_field_invoice_later_at is
  'Phase 2P: customer requested invoice be emailed later (field capture); not a billing state machine.';

create index if not exists idx_blitzpay_payment_plans_org_work_order
  on public.blitzpay_payment_plans (organization_id, work_order_id)
  where work_order_id is not null;
