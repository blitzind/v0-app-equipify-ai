# Operational RBAC — Phase 1

## Summary

Centralized **system-managed** permissions are derived from `organization_members.role` (`owner` | `admin` | `manager` | `tech` | `viewer`) via `getOrgPermissionsForRole()` in [`lib/permissions/model.ts`](../lib/permissions/model.ts). The dashboard loads the active membership role in [`OrgPermissionsProvider`](../lib/org-permissions-context.tsx) and exposes `useOrgPermissions()` for UI gating.

Legacy demo `useTenant().can()` now bridges from real permissions when the provider is mounted (see [`lib/permissions/legacy-tenant-bridge.ts`](../lib/permissions/legacy-tenant-bridge.ts) and [`lib/tenant-store.tsx`](../lib/tenant-store.tsx)).

## Key surfaces

| Area | Behavior |
|------|----------|
| Sidebar | [`components/app-sidebar.tsx`](../components/app-sidebar.tsx) filters nav items by permission keys + AI plan access |
| Settings nav | [`app/(dashboard)/settings/layout.tsx`](../app/(dashboard)/settings/layout.tsx) hides links users cannot use |
| Account hub | [`components/app-topbar.tsx`](../components/app-topbar.tsx) filters launcher shortcuts |
| Invoice drawer | [`components/drawers/invoice-detail-view.tsx`](../components/drawers/invoice-detail-view.tsx) hides totals, payments tab, billing actions when `!canViewBilling` |
| Archive | [`lib/use-org-archive-permissions.ts`](../lib/use-org-archive-permissions.ts) uses `canArchiveRecords` (no duplicate membership fetch) |
| Certificates | Manual portal release button respects `canReleaseCertificatesToPortal` |
| Reports API | [`reports/analytics/route.ts`](../app/api/organizations/[organizationId]/reports/analytics/route.ts) requires operational or financial report access |

## Server helpers

- [`requireOrgPermission`](../lib/api/require-org-permission.ts), [`requireAnyOrgPermission`](../lib/api/require-org-permission.ts), [`requireOrgMemberSession`](../lib/api/require-org-permission.ts) — use on organization-scoped Route Handlers for session + capability gates (RLS remains authoritative). The older `lib/permissions/require-org-permission.ts` stub was removed in Phase 62.1 (unused).

## Migration notes

No database migrations. Roles continue to live on `organization_members.role`.

## TODOs (later phases)

- Per-action audit rows (`released_by`, `override_changed_by`, inventory ledger actor already partially supported).
- Tech-only **consume inventory** API path separate from manager **adjust** (currently catalog/inventory write stays manager+).
- Page-level **403** views when users deep-link to hidden settings routes.
- Custom roles / department scopes.
