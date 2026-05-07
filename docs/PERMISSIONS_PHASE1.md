# Role-based Permissions — Phase 1

Equipify defines five system roles on `organization_members.role`:

| Role | Persona | Default scope |
| --- | --- | --- |
| `owner` | Account holder | Full access — including subscription billing and security policies |
| `admin` | Operations leader | Full access except for transferring ownership |
| `manager` | Field manager / dispatcher / billing operations | Manages day-to-day operations: dispatch, technicians, quotes, invoices, certificates, inventory |
| `tech` | Field technician | Field-only — view assigned work, update work orders, consume parts, upload certificate attachments |
| `viewer` | Read-only auditor / executive | Read-only — sees customers, equipment, work orders, dispatch, and operational reports |

Phase 1 introduces a **central capability map** (`OrgPermissions`) layered on
top of the DB roles. The capability map is the source of truth for both UI
gating and API guards. It does **not** replace Supabase RLS — RLS still
enforces tenant isolation. Capability checks add a second layer of defense.

## Capability map

`lib/permissions/model.ts` exports `OrgPermissions` and
`getOrgPermissionsForRole(role)`. Phase 1 added these explicit capabilities:

| Capability | Owner | Admin | Manager | Tech | Viewer |
| --- | --- | --- | --- | --- | --- |
| `canViewFinancials` | yes | yes | yes | no | yes |
| `canEditInvoices` | yes | yes | yes | no | no |
| `canViewQuotes` | yes | yes | yes | no | yes |
| `canEditQuotes` | yes | yes | yes | no | no |
| `canEditWorkOrders` | yes | yes | yes | yes | no |
| `canUploadCertificateAttachments` | yes | yes | yes | yes | no |
| `canAdjustInventoryStock` | yes | yes | yes | no | no |
| `canManageSettings` | yes | yes | yes | no | no |

Existing capabilities (`canManageDispatch`, `canManageInventory`,
`canManageCertificateTemplates`, `canViewBilling`, `canEditOrgBilling`,
`canManageWorkspaceSettings`, `canArchiveRecords`, etc.) are unchanged —
this phase is purely additive.

### Role behavior summary

- **Owner / Admin** — every capability is true. Owners additionally control
  subscription billing and ownership transfer.
- **Manager** — true for every operational capability and most settings,
  false for `canEditOrgBilling`, `canManagePortalSettings`, security, API
  keys, automations, and historical CSV imports.
- **Tech** — true only for `canViewDispatch`, `canViewTechnicians`,
  `canConsumePartsOnWorkOrders`, `canEditWorkOrders`, and
  `canUploadCertificateAttachments`. Every billing / quote / invoice /
  inventory adjust / settings capability is **false**, so the UI must hide
  the surface or render a `<RestrictedNotice>`.
- **Viewer** — true for `canViewBilling`, `canViewFinancials`,
  `canViewQuotes`, and operational read capabilities. Every "edit" or
  "manage" capability is false.

## How to gate UI

```tsx
import { PermissionGate } from "@/components/permissions/permission-gate"
import { RestrictedNotice } from "@/components/permissions/restricted-notice"

// Hide the button entirely for restricted roles:
<PermissionGate capability="canEditInvoices">
  <Button onClick={openNewInvoice}>New Invoice</Button>
</PermissionGate>

// Block the entire route with an explanatory empty state:
if (!permissions.canViewFinancials) {
  return <RestrictedNotice capability="canViewFinancials" />
}
```

Both helpers read from `useOrgPermissions()`, which is wired into the app
shell already. Use them instead of inline `role === "tech"` checks.

## How to gate APIs

`lib/api/require-org-permission.ts` exports `requireOrgPermission` and
`requireAnyOrgPermission`. Each returns either `{ userId, supabase, role,
permissions }` or `{ error: NextResponse }`:

```ts
const gate = await requireOrgPermission(organizationId, "canAdjustInventoryStock")
if ("error" in gate) return gate.error
```

Platform admins (resolved by email) bypass the capability check but still
need a valid Supabase auth session. Existing routes that use legacy gates
(`requireOrgCatalogWrite`, `requireOrgInventoryWrite`,
`roleCanManageOperationalCertificateRules`, etc.) keep working — Phase 1
adds capability checks **alongside** those guards rather than replacing
them.

## Conventions

1. **Never rely solely on UI hiding.** Gating buttons in the UI is an
   accessibility hint, not a security boundary. Pair every UI gate with a
   server check (`requireOrgPermission`) plus the existing RLS row policy.
2. **Keep DB roles as the source of truth.** Capability flags are derived
   on every render — there is no per-user override table yet. A future
   phase can add `organization_member_capabilities` overrides without
   changing call sites.
3. **Avoid duplicate permission systems.** Use `OrgPermissions` keys
   everywhere; do not introduce new role enums.
4. **Capability naming.** Read flags start with `canView…`, write flags
   start with `canEdit…` / `canAdjust…` / `canManage…`. Surface area is
   recorded in `lib/permissions/capabilities.ts`.

## Phase 1 application surface (UI)

- `/invoices` — entire route is wrapped in `canViewFinancials`. New
  Invoice button is gated by `canEditInvoices`.
- `/quotes` — entire route is wrapped in `canViewQuotes`. New Quote button
  is gated by `canEditQuotes`.
- Server routes:
  - `POST /api/organizations/:id/inventory/adjust` — adds an explicit
    `canAdjustInventoryStock` capability check on top of the existing
    manager-role gate.

## Phase 1 application surface (server)

The new `requireOrgPermission` helper is wired in for the inventory adjust
endpoint and is the canonical helper for future Phase 2 hardening.
Existing helpers (`requireOrgCatalogWrite`, `getOrganizationMemberRole`,
`roleCanManageOperationalCertificateRules`, etc.) continue to work and can
be migrated incrementally.

## Future phases

- Custom per-org capability overrides (e.g. "billing-only" or
  "dispatcher" sub-roles) without changing the DB role enum.
- Per-record ACLs for confidential customers / equipment.
- An admin UI under Settings → Permissions that mirrors the live
  capability map (today the page renders a static reference).
- Migrate the remaining inventory / dispatch / certificate routes to the
  capability gate so naming is consistent end-to-end.
