# Role-Based Permissions — Phase 2

Phase 2 builds on the Phase 1 capability map (`lib/permissions/model.ts`,
`lib/permissions/capabilities.ts`) by:

1. Migrating remaining mutation routes to the central `requireOrgPermission`
   helper (or refactoring existing manager+ gates to derive from the same
   capability map).
2. Hiding mutation UI for non-edit roles using `<PermissionGate>` /
   `<RestrictedNotice>` so screens never appear blank without explanation.
3. Replacing the static Settings → Permissions matrix with a live view
   generated directly from `OrgPermissions`.

Phase 2 is fully **additive**:

- No changes to `auth`, `organization_members`, or RLS.
- No new database migrations.
- No changes to QuickBooks sync, the customer portal, or invoice/quote
  schemas.
- All previous server-side membership checks remain in place; the new
  capability checks layer on top of them.

---

## Capability coverage added in Phase 2

| Surface | Mutation route | Capability(s) | Allowed roles |
|---|---|---|---|
| Invoices | `POST /api/email/invoice` | `canEditInvoices` | owner, admin, manager |
| Invoices | `POST /api/invoices/send-email` | `canEditInvoices` | owner, admin, manager |
| Invoices | `PATCH /api/organizations/{org}/invoices/{id}/certificate-release-override` | `canReleaseCertificatesToPortal` | owner, admin, manager |
| Invoices | `POST /api/organizations/{org}/integrations/quickbooks/invoice-auto-sync` | `canEditInvoices` | owner, admin, manager |
| Quotes | `POST /api/email/quote` | `canEditQuotes` | owner, admin, manager |
| Work orders | `POST /api/email/work-order-summary` | `canEditWorkOrders` ∨ `canManageDispatch` | owner, admin, manager, tech |
| Work orders | `POST /api/work-orders/scheduling-events` | `canEditWorkOrders` ∨ `canManageDispatch` | owner, admin, manager, tech |
| Certificates | `POST /api/email/certificate` | `canReleaseCertificatesToPortal` | owner, admin, manager |
| Certificates | `POST /api/organizations/{org}/calibration-records/{id}/portal-release` | `canReleaseCertificatesToPortal` | owner, admin, manager |
| Certificates | `PATCH /api/organizations/{org}/customers/{id}/portal-certificate-release` | `canReleaseCertificatesToPortal` | owner, admin, manager |
| Certificates | `PATCH /api/organizations/{org}/portal/certificate-release-default` | `canManagePortalSettings` | owner, admin |
| Certificates | `POST /api/organizations/{org}/calibration-templates/import-commit` | `canManageCertificateTemplates` | owner, admin, manager |
| Inventory | `POST /api/organizations/{org}/inventory/{adjust,receive,transfer,consume,allocate,deallocate,thresholds,reorder-record,vehicle-stock,locations}` | `canManageInventory` (via `requireOrgCatalogWrite`) | owner, admin, manager |

> The existing `requireOrgCatalogWrite` helper is unchanged from a behavior
> perspective but now derives its allow list from
> `getOrgPermissionsForRole(role).canManageInventory`. Callers can pass
> `{ capability }` to gate alternate surfaces (used by the calibration
> templates import route which now requires
> `canManageCertificateTemplates`).

---

## Architectural decisions

- **Capability map is the source of truth.** UI gates (`PermissionGate`,
  `useHasCapability`) and API gates (`requireOrgPermission`,
  `requireAnyOrgPermission`, `requireOrgCatalogWrite`) all read from
  `getOrgPermissionsForRole(role)` so role updates propagate everywhere
  without code edits.
- **RLS is still authoritative for data scope.** Capability checks return
  consistent 403 JSON shapes (`{ error: "insufficient_permissions",
  message: "…" }`) before the database is touched, but RLS continues to
  filter rows for any direct Supabase reads/writes.
- **No widening of access.** Wherever existing routes were already manager+
  (e.g. `requireOrgInventoryWrite`, `requireOrgCatalogWrite`), the
  capability used (`canManageInventory`) resolves to exactly that role
  set — no behavioral change.
- **Techs keep operational write access.** Tech roles can still consume
  parts on assigned work orders, edit work orders, post scheduling notes,
  and upload certificate attachments — only billing / quote pricing /
  settings / inventory mutations are blocked.
- **Owner / admin remain unrestricted.** Both keep full access to every
  capability flag (and platform admins bypass per-org checks via
  `isPlatformAdminEmail`).

---

## UI changes

- **Settings → Permissions** is now generated from `CAPABILITY_METADATA`
  + `getOrgPermissionsForRole`. The page no longer hard-codes a
  Dispatcher/Billing/Read-Only matrix that doesn't reflect the live
  system.
- **Invoice drawer** hides "Email to Customer", "Resend", "Record
  Payment", and the actions dropdown for roles that lack
  `canEditInvoices`. An inline `<RestrictedNotice>` explains the gate.
- **Quote drawer** hides Edit / Email / Convert / Archive triggers for
  roles that lack `canEditQuotes`.
- **Work order drawer** hides post-completion actions (Create Invoice,
  Draft Email, Email work summary) for roles that lack
  `canEditWorkOrders`. Read-only viewers still see the timeline and
  attachments.

---

## Verification

- `pnpm build` passes with no new TypeScript / ESLint errors.
- `pnpm update:master-context` regenerates the AI master context, so any
  in-app assistant remains aware of the new gating.

---

## Out of scope (still on the Phase 3+ roadmap)

- Custom roles / per-user overrides.
- Splitting `canViewBilling` from `canViewFinancials` for a billing-only
  persona (currently mirrored).
- Tech-callable inventory `consume` route (currently still manager+; tech
  consumption flows go through RLS-direct supabase calls in the work
  order detail experience).
- Audit log surfacing of permission denials.
