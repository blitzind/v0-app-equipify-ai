# Portal Settings UI — Phase 1

> **Propagation:** For which controls persist and how they reach the real portal vs preview, see **`PORTAL_SETTINGS_PROPAGATION.md`** (Phase 56.2).

## Summary

Staff-facing controls for **consolidated portal document access** (parent-account
rollup) without SQL, plus a **read-only activity** list for document library
views and downloads.

## Files changed

| Path | Change |
| --- | --- |
| `app/api/organizations/[organizationId]/portal/consolidated-documents-default/route.ts` | **New** — GET (any member) / PATCH (`canManagePortalSettings`) for workspace default; schema-drift safe |
| `app/api/organizations/[organizationId]/customers/[customerId]/portal-consolidated-documents/route.ts` | **New** — PATCH with `requireAnyOrgPermission` for owner/admin **or** manager (certificate release parity) |
| `app/api/organizations/[organizationId]/portal/document-access-activity/route.ts` | **New** — GET recent `portal_document_index_view` / `portal_document_download` via service role; sanitized metadata |
| `app/(dashboard)/settings/portal/page.tsx` | Workspace toggle, confirmation before enable, doc activity table |
| `components/customers/customer-portal-consolidated-docs-card.tsx` | **New** — overview card + effective state |
| `app/(dashboard)/customers/[id]/page.tsx` | Select `portal_consolidated_documents_enabled`, edit form, save via API |
| `lib/admin/master-context.generated.ts` | Regenerated |

## Migrations

None. Uses existing columns from `20260723120000_portal_document_library_phase2.sql`.

## Architectural decisions

1. **Workspace default PATCH** — `canManagePortalSettings` only (owner / admin),
   same as **Certificate release default** in the same page.

2. **Customer override PATCH** — `requireAnyOrgPermission([canManagePortalSettings,
   canReleaseCertificatesToPortal])` so **managers** can set per-customer
   overrides, consistent with
   `portal-certificate-release` customer routes.

3. **Activity feed** — `portal_activity_logs` is not readable with the user JWT
   (RLS / revoke). The list endpoint uses **service role** only **after** the
   same org permission gate. Response fields: time, label, kind/source_category
   (from metadata). **No** `resource_id`, **no** URLs, **no** storage paths.

4. **UI guardrails** — Toggling consolidated **on** opens a confirmation
   dialog. Toggle is disabled for non–portal-settings roles and while schema
   is pending. Default remains **off** in copy and behavior.

5. **Customer overview card** — Duplicates the small “effective consolidated”
   predicate locally so we do not bundle server scope helpers into the client.

## TODOs

- Optional: refresh activity table after saving portal defaults (low value).
- Future: staff UX for `portal_activity_logs` pagination / filters.

## Verification

- `pnpm update:master-context` — OK (133 API routes).
- `pnpm build` — passes.

## Deploy notes

- Requires Phase 2 portal document migration for full functionality; UI/API
  degrade gracefully with `schema_migration_pending` / 503 on PATCH when
  columns are missing.

## Commit / push

```bash
git add equipify-app/app/api/organizations/[organizationId]/portal/consolidated-documents-default/route.ts \
  equipify-app/app/api/organizations/[organizationId]/customers/[customerId]/portal-consolidated-documents/route.ts \
  equipify-app/app/api/organizations/[organizationId]/portal/document-access-activity/route.ts \
  equipify-app/app/\(dashboard\)/settings/portal/page.tsx \
  equipify-app/components/customers/customer-portal-consolidated-docs-card.tsx \
  equipify-app/app/\(dashboard\)/customers/\[id\]/page.tsx \
  equipify-app/lib/admin/master-context.generated.ts \
  equipify-app/docs/PORTAL_SETTINGS_UI_PHASE1.md

git commit -m "Portal Settings UI Phase 1: consolidated docs controls + activity"
git push origin HEAD
```
