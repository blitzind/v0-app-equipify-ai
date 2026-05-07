# Customer Portal Document Access — Phase 1

> Phase: Customer Portal Document Access
>
> Goal: give portal customers a single, self-service surface that lists
> the documents they're entitled to — invoices, certificates, service
> summaries, and uploaded certificate attachments — with clear
> availability states and predictable filtering.
>
> All changes are additive. Portal session/cookie auth, RLS, customer
> scoping, certificate release rules, invoice payment/release logic, and
> parent/child customer hierarchy foundations are preserved verbatim.

## Highlights

1. **New `/portal/documents` page** — unified library that lists every
   document the customer can see, grouped by kind (Invoices,
   Certificates, Service summaries, Uploaded documents). Filters: free
   text search, kind chips, equipment dropdown, date range, and
   "available only" toggle. Helpful empty states ("No documents
   available yet" / "Some certificates may appear after invoice
   payment") and a banner when the customer has locked items.

2. **New `/api/portal/documents` route** — single GET endpoint backed by
   `buildPortalDocuments(svc, { organizationId, customerIds })`.
   Phase 1 always passes `[portalUser.customer_id]` but the helper
   accepts an array so the parent-account rollup phase only needs to
   change one call site.

3. **New `/api/portal/certificate-attachments/[attachmentId]/download`
   route** — short-lived signed-URL redirect for uploaded
   certificate attachments. Strict release gate: parent
   calibration record must be unlocked under the existing
   `canPortalDownloadCertificate` policy. No new release semantics.
   Attachments without a parent record are not exposed in the portal
   in Phase 1.

4. **Nav + dashboard wiring** — added "Documents" nav entry to the
   portal shell, swapped the legacy "Reports" quick action for a
   "Documents" tile, and added an "All documents" CTA next to the
   existing Compliance documents card.

## Architectural decisions

- **No duplicate document systems.** All four document kinds reuse the
  *existing* portal data sources:
  - Invoices: `org_invoices` (filtered to non-draft / non-void).
  - Certificates: `buildPortalCertificateItems` — release evaluation
    flows verbatim through the existing
    `resolveEffectiveCertificateReleaseMode` / `evaluateCertificatePortalAccess`
    pipeline.
  - Service summaries: completed/invoiced `work_orders` for the
    portal customer.
  - Uploaded documents: `certificate_attachments` rows whose parent
    `calibration_record_id` is one of the records already evaluated
    above. This means the attachment's availability *exactly mirrors*
    its parent certificate's release decision — no new gate.

- **Parent-account rollup foundation, not enabled.** The aggregator
  signature is `customerIds: string[]`. Phase 1 always passes a single
  id sourced from `portalUser.customer_id`, so the request "do not
  fully enable cross-account access" is honored. A future phase that
  wants to surface a parent customer's children only needs to walk the
  existing `parent_customer_id` hierarchy and pass the resolved id list
  in. No rewrite required.

- **No raw UUIDs in customer-facing UI.** Document `key` is a
  `<kind>:<sourceId>` string used only as a React key and download path
  fragment. Display strings use `getWorkOrderDisplay`,
  `mapInvoiceStatus`, equipment names, and template names already in
  use elsewhere.

- **Signed download URLs only.** Attachments are served as a 302
  redirect to a Supabase Storage signed URL with a short TTL (10 min),
  mirroring the pattern already used by the work-order attachments
  flow. The route re-runs the parent-cert release gate every call so
  no link can outlive a release rule change.

- **Schema-drift safe.** `certificate_attachments` may not exist in
  every database; the aggregator catches PostgREST errors and silently
  omits the section instead of 500ing.

## Files changed

### New
- `lib/portal/portal-documents.ts` — `buildPortalDocuments` aggregator
  + types (`PortalDocumentKind`, `PortalDocumentAvailability`,
  `PortalDocumentItem`, `PortalDocumentsResult`).
- `app/api/portal/documents/route.ts` — GET endpoint.
- `app/api/portal/certificate-attachments/[attachmentId]/download/route.ts`
  — gated signed-URL redirect for attachment downloads.
- `app/(portal)/portal/documents/page.tsx` — Documents page with
  search/filters/groups/empty states.
- `docs/PORTAL_DOCUMENT_LIBRARY_PHASE1.md` — this doc.

### Modified
- `components/portal/portal-shell.tsx` — added "Documents" nav entry.
- `app/(portal)/portal/dashboard/page.tsx` — swapped the Reports
  quick-action tile for a Documents tile and added an
  "All documents" CTA next to the existing Compliance documents
  card.

## Migrations

None. Phase 1 ships entirely on top of existing tables
(`org_invoices`, `work_orders`, `equipment`, `calibration_records`,
`certificate_attachments`).

## Availability states (UI ↔ data)

| State              | Surface                              | Source                                        |
| ------------------ | ------------------------------------ | --------------------------------------------- |
| `available`        | Pill: "Available", Download/View     | Cert unlocked, invoice non-draft, WO complete |
| `awaiting_payment` | Pill: "Awaiting payment"             | `reasonCode === "locked_payment"`             |
| `awaiting_release` | Pill: "Awaiting release"             | `reasonCode === "locked_manual"`              |
| `not_yet_available`| Pill: "Not yet available"            | Other locked reasons / non-final WO status    |

## Verification

- `pnpm update:master-context` — refreshed.
- `pnpm build` — green.
- `ReadLints` — clean across all new + edited files.

## TODOs / follow-ups

- **Parent-account rollups (Phase 2)**: walk
  `customers.parent_customer_id` to resolve the rollup customer id
  set, gate behind a workspace setting, and pass the resolved list to
  `buildPortalDocuments`. The aggregator already supports this.
- **Invoice PDF downloads**: when the invoice PDF generator is
  wired up, populate `downloadPath` for invoice items.
- **Release status** could surface the parent invoice number on
  certificates marked `awaiting_payment` (we already know it
  internally). Held back to keep Phase 1 surface tight.
- **Telemetry**: a dedicated `portal_document_download` event in
  `communication_events` would help track customer self-serve
  effectiveness.

## Deploy notes

- No DB migrations.
- No environment changes.
- All routes inherit the existing `requirePortalSession` cookie auth.
- Backward compatible: existing portal pages, APIs, and download
  flows are unchanged. Customers with no locked items see no banner;
  customers with no documents see the friendly empty state.
