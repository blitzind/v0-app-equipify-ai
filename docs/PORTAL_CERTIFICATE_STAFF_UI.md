# Portal certificate release — staff UI (phase 1)

## Summary

Staff can configure **when calibration certificates appear in the customer portal** at three levels: **organization default**, **customer override**, and **invoice override**. Staff can **manually release** a certificate (`calibration_records.portal_released_at`) when the effective rule is manual. UI copy reuses `lib/portal/certificate-release.ts` and `staffPortalCertificateBullets()` so explanations stay aligned with portal behavior.

## Migration notes

No new migrations in this phase. Requires existing columns:

- `organizations.portal_certificate_release_mode`
- `customers.portal_certificate_release_mode`
- `org_invoices.portal_certificate_release_override`
- `calibration_records.portal_released_at`

## API routes

| Method | Path | Purpose |
|--------|------|---------|
| GET/PATCH | `/api/organizations/[organizationId]/portal/certificate-release-default` | Org default (PATCH: owner/admin) |
| PATCH | `/api/organizations/[organizationId]/customers/[customerId]/portal-certificate-release` | Customer override (`null` = inherit) |
| PATCH | `/api/organizations/[organizationId]/invoices/[invoiceId]/certificate-release-override` | Invoice override |
| POST | `/api/organizations/[organizationId]/calibration-records/[recordId]/portal-release` | Manual release timestamp |

## UI surfaces

| Area | File / component |
|------|------------------|
| Settings → Portal | `app/(dashboard)/settings/portal/page.tsx` — default release mode |
| Customer detail & edit | `app/(dashboard)/customers/[id]/page.tsx` — badge + edit drawer field |
| Invoice drawer Info | `components/drawers/invoice-detail-view.tsx` → `InvoicePortalCertificatePanel` |
| Invoice panel | `components/invoices/invoice-portal-certificate-panel.tsx` |
| Work order certificates | `components/work-orders/certificate-multi-tab-content.tsx` → `certificate-tab-content.tsx` |

## Shared helpers

- `lib/portal/certificate-release-staff.ts` — dropdown options, `modeLabel`, `staffPortalCertificateBullets`
- `lib/api/org-role.ts` — `roleCanEditOrgPortalCertificateDefault`, `roleCanManageOperationalCertificateRules`

## TODOs (later phases)

- Surface invoice-level override in contexts where multiple invoices link to one work order (pick precedence or per-cert lineage).
- Activity / audit log entries for manual portal release if a first-class audit stream is added.
- Align mock-only portal settings (branding, modules) with persisted org settings when that product work lands.
