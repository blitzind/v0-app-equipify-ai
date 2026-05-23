-- Repair migration: soft-delete columns + service_role grants (idempotent).

alter table growth.email_provider_connections
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users (id) on delete set null;

create index if not exists idx_growth_email_connections_not_deleted
  on growth.email_provider_connections (created_at desc)
  where deleted_at is null;

grant select, insert, update, delete on table growth.email_provider_connections to service_role;
