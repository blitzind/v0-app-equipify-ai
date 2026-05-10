# Permissions & capability enforcement audit (Phase 57.3)

Equipify combines **database roles** (`organization_members.role`), optional **commercial permission profiles** (`permission_profile`), optional **`permissions_json` overrides**, **RLS** on tenant tables, and Route Handler gates via `lib/api/require-org-permission.ts` (`requireOrgPermission`, `requireAnyOrgPermission`, `requireOrgMemberSession`).

**Source of truth:** server checks + RLS. Client nav (`components` / `app/(dashboard)`) hides controls for UX but must not be relied on for security.

## Core helpers

| Artifact | Role |
| --- | --- |
| `lib/permissions/model.ts` | `getOrgPermissionsForRole`, `getOrgPermissionsForProfile`, `getEffectiveOrgPermissions`, `hasOrgPermission` |
| `lib/api/require-org-permission.ts` | Session + membership + capability checks (platform-admin bypass for capability only) |
| `lib/api/org-role.ts` | `getOrganizationMemberRecord` (role + profile + JSON), `getOrganizationMemberRole` (wrapper) |
| `lib/permissions/technician-scope.ts` | Assigned-work scope for technicians; used by AIden productivity + global search |
| `lib/global-search/run-global-search.ts` | Applies `OrgPermissions` + assigned scope to search groups |
| `lib/portal/preview-access.ts` | Staff portal preview: effective `canManagePortalSettings` |
| `app/(dashboard)/settings/layout.tsx` | Settings nav visibility from **role-default** permissions (intentional; avoids profile drift on refresh) |

## Enforcement matrix (selected modules)

Statuses: **aligned** | **UI-only** (client hides only) | **server-only** (API ok, nav not profile-driven) | **needs follow-up** | **intentionally staged**

| Module / action | UI visibility rule | API / server enforcement | RLS | Status |
| --- | --- | --- | --- | --- |
| **Customers** | Nav + pages for org members; technician customer reads often WO-linked | Mixed: many routes use member session + app checks; customer productivity uses `assertCustomerProductivityAccess` | Yes | **aligned** (detail varies by route) |
| **Equipment** | Same pattern | Same | Yes | **aligned** |
| **Work orders** | Technician workspace narrows lists | WO AI productivity: `resolveProductivityRequest` + `assertWorkOrderProductivityAccess` (assigned-only → 404) | Yes | **aligned** |
| **Scheduling** | Dispatch capabilities | Dispatch APIs use permission helpers where implemented | Yes | **needs follow-up** (spot-check new routes per feature) |
| **Maintenance plans** | `canManageDispatch` / membership | Cron + APIs scoped by org | Yes | **intentionally staged** |
| **Technicians** | Roster vs field UX | Team APIs + `requireOrgPermission` patterns on mutations | Yes | **aligned** |
| **Quotes** | `canViewQuotes` / `canEditQuotes` | Quote routes should gate edit vs view | Yes | **needs follow-up** (sample each mutation route) |
| **Invoices** | Financial rollup | Invoice mutations: `canEditInvoices` / `canViewFinancials` on specific routes | Yes | **aligned** (verify remaining email/send paths) |
| **Purchase orders** | Module nav | Org-scoped APIs | Yes | **needs follow-up** |
| **Inventory** | `canManageInventory`, `canAdjustInventoryStock`, truck stock | `inventory/adjust` and related use `requireOrgPermission` | Yes | **aligned** (per Phase patterns) |
| **Certificates** | Template vs release | Portal release routes gate `canReleaseCertificatesToPortal` / overrides | Yes | **aligned** |
| **Portal settings** | Settings nav: `canManagePortalSettings` (role defaults) | PATCH portal defaults: `requireOrgPermission` | Yes | **aligned** |
| **Portal preview** | Staff preview shell | **Phase 57.3:** `staffMayOpenPortalPreviewFromMembership` uses **effective** `canManagePortalSettings` | Service role reads after gate | **aligned** |
| **Portal invites** | Same as portal settings intent | **Phase 57.3:** `requireOrgPermission(canManagePortalSettings)` replaces owner/admin/manager role list | Svc after gate | **aligned** |
| **Team / settings** | Team: workspace managers; settings layout uses role defaults | Team routes use permission helpers | Yes | **server-only** vs settings nav (documented) |
| **Integrations / QuickBooks** | `canManageIntegrations` | `requireOrgIntegrationAdmin` + financial detail gate for logs | Yes / svc | **aligned** |
| **Reports** | `canViewOperationalReports` / financial | `reports/analytics` uses permission gate | Yes | **aligned** (spot-check financial reports) |
| **AI / AIden** | Plan + capability | Productivity context: work-order view + billing + plan tier | Yes | **aligned** |
| **Communications** | `canViewCommunications` | Several routes use `getOrganizationMemberRole` for legacy checks | Yes | **needs follow-up** (migrate to `requireOrgPermission` / effective) |
| **Global search** | Desktop header | `requireOrgMemberSession` + `runOrgGlobalSearch` filters by `OrgPermissions` + assigned scope | Yes | **aligned** |
| **Workspace PATCH** | Settings workspace page | **Phase 57.3:** `requireOrgPermission(canManageWorkspaceSettings)` replaces owner/admin-only raw role check | Svc update after gate | **aligned** |
| **Billing default invoice terms** | Invoicing settings surfaces | **Phase 57.3:** GET requires financial read; PATCH `canEditOrgBilling` | Yes | **aligned** |
| **Admin / platform** | `/admin` layout | Platform admin email policy + separate APIs | N/A | **aligned** |

## Technician assigned-only (summary)

- **Global search:** `isAssignedWorkOnly` + `loadAssignedWorkScope` restrict customers, equipment, WOs, and related groups (see `run-global-search.ts`).
- **AIden productivity:** `assertWorkOrderProductivityAccess` / `assertCustomerProductivityAccess` return **404** (not 403) for out-of-scope IDs where applicable — avoids leaking existence across assignment boundaries.
- **Direct WO URLs:** RLS + app checks on detail APIs; technicians should not receive other orgs’ data.

## Settings nav vs effective permissions (intentional)

`settings/layout.tsx` resolves nav from **`getOrgPermissionsForRole(role)`** only (comment: avoid profile drift on refresh). **APIs** still use `getEffectiveOrgPermissions` via `requireOrgPermission`. Result: a user with a **profile overlay** might see slightly different nav than strict effective caps, but **mutations remain blocked** without the right capability. **Remaining gap:** optional future work to reconcile nav with effective read-only flags without breaking stability.

## Phase 57.3 code changes (reference)

| Change | File(s) |
| --- | --- |
| Membership fetch includes profile + JSON | `lib/api/org-role.ts` |
| Portal preview gate uses effective `canManagePortalSettings` | `lib/portal/preview-access.ts`, `app/(portal)/portal/preview/page.tsx`, `app/api/portal/preview/start/route.ts`, `lib/portal/staff-preview-load.ts` |
| Portal invites → `canManagePortalSettings` | `app/api/organizations/[organizationId]/portal-invites/route.ts` |
| Workspace PATCH → `canManageWorkspaceSettings` | `app/api/organizations/[organizationId]/workspace/route.ts` |
| Default invoice terms GET/PATCH → capability gates | `app/api/organizations/[organizationId]/billing/default-invoice-terms/route.ts` |
| Legacy `requireOrgMemberPermission` uses effective perms | `lib/permissions/require-org-permission.ts` |

## Remaining gaps (deferred)

- Communications and some AI-Ops routes still branch on **raw role** (`getOrganizationMemberRole`) in places — migrate incrementally to `requireOrgPermission` / `requireAnyOrgPermission` with the same capability keys the UI implies.
- Quote / PO mutation routes: systematic pass to ensure every **POST/PATCH/DELETE** has an explicit gate (RLS is not a substitute for clear 403 UX on APIs using service role).
- Profile-driven **navigation** parity: product decision — out of scope for 57.3 per constraints.

## Changelog

- **2026-05-10 — Phase 57.3:** Initial matrix + enforcement fixes listed above.
