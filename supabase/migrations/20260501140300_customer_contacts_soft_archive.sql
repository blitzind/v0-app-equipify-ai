-- Add soft-archive support for customer contacts

alter table public.customer_contacts
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz;

create index if not exists idx_customer_contacts_org_customer_archived
  on public.customer_contacts (organization_id, customer_id, is_archived);
