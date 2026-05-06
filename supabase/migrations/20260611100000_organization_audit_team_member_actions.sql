-- Extend tenant audit actions for team / membership events (written from API via service role).

alter table public.organization_audit_events
  drop constraint if exists organization_audit_events_action_check;

alter table public.organization_audit_events
  add constraint organization_audit_events_action_check
  check (action in (
    'record_archived',
    'record_restored',
    'member_invited',
    'member_role_changed',
    'member_suspended',
    'member_reactivated',
    'member_removed'
  ));

comment on table public.organization_audit_events is
  'Tenant audit trail: archive/restore, team membership changes; written from authenticated API routes using service role.';
