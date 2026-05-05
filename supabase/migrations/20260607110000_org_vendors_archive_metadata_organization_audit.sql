-- Vendor archive metadata alignment + tenant audit events for archive/restore.

alter table public.org_vendors
  add column if not exists archived_by uuid references auth.users (id) on delete set null;

alter table public.org_vendors
  add column if not exists archive_reason text;

-- -----------------------------------------------------------------------------
-- Tenant-level audit (archive / restore of CRM rows); inserts via service-role API.
-- -----------------------------------------------------------------------------
create table if not exists public.organization_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  action text not null check (action in ('record_archived', 'record_restored')),
  actor_user_id uuid references auth.users (id) on delete set null,
  record_type text not null,
  record_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_organization_audit_events_org_created
  on public.organization_audit_events (organization_id, created_at desc);

comment on table public.organization_audit_events is
  'Tenant audit trail for record_archived / record_restored; written from authenticated API routes using service role.';

revoke all on table public.organization_audit_events from public, anon;

grant select on table public.organization_audit_events to authenticated;

alter table public.organization_audit_events enable row level security;

drop policy if exists "organization_audit_events_select_member" on public.organization_audit_events;

create policy "organization_audit_events_select_member"
on public.organization_audit_events
for select
to authenticated
using (public.is_org_member (organization_id));
