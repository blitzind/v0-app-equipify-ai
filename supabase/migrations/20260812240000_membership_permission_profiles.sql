-- Phase 20: commercial permission profiles layered on existing DB roles.
-- Keep organization_members.role as the broad RLS tier; these fields are used
-- by application/server guards for finer product capabilities.

alter table public.organization_members
  add column if not exists permission_profile text,
  add column if not exists permissions_json jsonb not null default '{}'::jsonb;

alter table public.organization_members
  drop constraint if exists organization_members_permission_profile_check;

alter table public.organization_members
  add constraint organization_members_permission_profile_check
  check (
    permission_profile is null or permission_profile in (
      'owner',
      'admin',
      'operations_manager',
      'technician',
      'billing',
      'sales',
      'viewer'
    )
  );

comment on column public.organization_members.permission_profile is
  'Optional commercial permission profile layered over role: owner | admin | operations_manager | technician | billing | sales | viewer.';
comment on column public.organization_members.permissions_json is
  'Optional boolean capability overrides consumed by application/API permission guards. RLS remains role-based.';
