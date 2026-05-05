-- Append-only audit trail for platform admin actions (written via service role).
create table if not exists public.platform_admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  organization_id uuid references public.organizations (id) on delete set null,
  admin_user_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_platform_admin_audit_org
  on public.platform_admin_audit_events (organization_id);

create index if not exists idx_platform_admin_audit_created
  on public.platform_admin_audit_events (created_at desc);

alter table public.platform_admin_audit_events enable row level security;

comment on table public.platform_admin_audit_events is
  'Platform admin audit events; inserts via service role API routes only.';
