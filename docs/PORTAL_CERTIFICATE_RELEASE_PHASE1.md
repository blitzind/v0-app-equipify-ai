# Portal certificate release & operational visibility — Phase 1

## Summary

Phase 1 turns the customer portal into a stronger **compliance and billing-awareness surface** without replacing portal auth/sessions:

- **Configurable certificate release** at organization and customer level (`immediate_release`, `release_on_payment`, `manual_release`), with optional **`org_invoices.portal_certificate_release_override`** for future per-invoice policy.
- **`calibration_records.portal_released_at`** for **manual** release when policy is `manual_release`.
- **Unified portal certificate payloads** with unlock state, customer-facing reason copy, and **HTML certificate download** (`GET /api/portal/certificates/[recordId]/download`) using existing `buildCompletedCertificatePdfHtml`.
- **Invoice detail** in the portal (`/portal/invoices/[invoiceId]`) with linked work orders, certificates (scoped to linked work orders or legacy `calibration_record_id`), and an **activity timeline** (`ServiceLifecycleTimeline`).
- **Compliance archive** UX on `/portal/certificates` (search + filters + summary counts).
- **Equipment detail** enhancements: calibration due date, recent certificates, invoices for that asset.
- **Dashboard** certificate summary strip + invoice rows link to invoice detail.

## Migration

Apply:

`supabase/migrations/20260506120000_portal_certificate_release_phase1.sql`

- Sets **`organizations.portal_certificate_release_mode`** default **`immediate_release`** (backward compatible).
- **`customers.portal_certificate_release_mode`** nullable (inherits org when null).
- **`org_invoices.portal_certificate_release_override`** nullable.
- **`calibration_records.portal_released_at`** nullable + index.

## Operational tuning

- **Org default**: update `organizations.portal_certificate_release_mode`.
- **Customer override**: update `customers.portal_certificate_release_mode`.
- **Manual release**: set `calibration_records.portal_released_at` when policy is `manual_release` (staff UI can be added later).

## Release logic (short)

1. Resolve **effective mode**: invoice override (first non-null on linked invoices) → customer → organization → **`immediate_release`**.
2. **`immediate_release`**: download allowed (subject to portal WO/customer scoping).
3. **`release_on_payment`**: if any invoice is linked to the certificate’s work order, **every** linked invoice must be **`paid`**; if **no** invoices are linked, download is allowed (field/service workflows without billing yet).
4. **`manual_release`**: allowed only when **`portal_released_at`** is set.

## Key files

| Area | Path |
|------|------|
| Rules | `lib/portal/certificate-release.ts`, `lib/portal/work-order-invoices.ts` |
| Portal certificate assembly | `lib/portal/portal-certificate-items.ts` |
| Certificate HTML loader | `loadCompletedCertificateItemByRecordId` in `lib/calibration-certificates.ts` |
| APIs | `app/api/portal/certificates/route.ts`, `.../certificates/[recordId]/download/route.ts`, `.../invoices/[invoiceId]/route.ts` |
| UI | `app/(portal)/portal/certificates/page.tsx`, `.../invoices/[invoiceId]/page.tsx`, equipment + dashboard updates |

## TODOs (later phases)

- Staff UI for **manual release** + customer/org policy pickers (currently DB-driven).
- Full use of **`portal_certificate_release_override`** when multiple invoices disagree (today: first non-null wins).
- Optional **PDF** binary response instead of HTML attachment.
- **Communications** feed in portal using existing communications APIs.
- **Parent / location RBAC** on `portal_users` (explicitly not implemented here).

## Build

`npm run build` passes.
