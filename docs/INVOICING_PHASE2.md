# Invoicing Phase 2 — Service-to-Invoice Continuity + Terms

Additive enhancements layered on top of the Phase 1 service lifecycle
schema (`20260719120000_service_lifecycle_phase1.sql`). Goal: invoices
clearly trace back to the service appointment / work order they came from,
support customer-level payment terms with automatic due-date math, and
expose the same operational context to the customer portal.

No schema changes were required for Phase 2 — Phase 1 already added the
`invoice_work_order_links` junction, `org_invoices.terms_code` /
`terms_custom_days`, `customers.default_invoice_terms_code`, and
`organizations.default_invoice_terms_code`.

## Files changed

### Helpers
- `lib/billing/invoice-terms.ts` — extended with `CUSTOMER_TERMS_OPTIONS`,
  `ORG_DEFAULT_TERMS_OPTIONS`, `resolveEffectiveTermsCode()`,
  `describeTermsResolution()`, and `netDaysForTermsCode()` so the UI can
  preselect the most-specific terms (customer override → org default → Net
  30 fallback) and show resolution source clarity badges.
- `lib/billing/invoice-source.ts` *(new)* — `buildInvoiceSourceSummary()`
  aggregates linked work orders (display number, type, status, scheduled /
  completed dates, equipment, technician, service location, billing state)
  plus a tally of certificates and how many are released. Tenant-scoped via
  `organization_id`; junction first, legacy column merged for old rows;
  schema-drift safe for missing `assigned_technician_id` and friends.

### Components
- `components/customers/customer-billing-terms-card.tsx` *(new)* —
  read-only Overview card explaining whether a customer inherits the
  workspace default invoice terms or overrides it; mirrors the visual
  language of the Phase 2 portal-cert clarity card.
- `components/invoices/invoice-source-panel.tsx` *(new)* — service source
  block on the invoice detail Info tab. Shows linked work orders with
  technician / equipment / service location / billing-state pill, plus a
  small `N certs · M released` chip in the header.
- `components/work-orders/linked-invoices-summary.tsx` *(new)* — compact
  invoice-status row on the work order drawer. Pills show
  `paid in full` / `N overdue` / `N awaiting payment` / `N draft`, and each
  invoice line shows status, terms label, and amount.

### Wiring
- `app/(dashboard)/customers/[id]/page.tsx` — loads
  `default_invoice_terms_code` (schema-drift safe with column-fallback
  select), adds the field to the edit modal as a select, persists the
  override (with column-missing fallback), and renders
  `CustomerBillingTermsCard` on the Overview tab.
- `components/invoices/new-invoice-modal.tsx` — when a customer is
  selected, resolves customer + org defaults and pre-selects the terms
  code (skipped once the user manually edits the select). Displays an
  inline helper line under the Payment Terms select. When a work order is
  selected, shows `N certs on linked job · M released` so the office has
  certificate-release context before sending.
- `components/drawers/invoice-detail-view.tsx` — renders
  `InvoiceSourcePanel` on the Info tab and a `Payment Terms` row showing
  the stored terms label (and custom days when applicable).
- `components/drawers/work-order-drawer.tsx` — renders
  `LinkedInvoicesSummary` next to operational signals so dispatchers see
  unpaid / overdue / paid status at a glance.
- `app/api/portal/invoices/[invoiceId]/route.ts` — returns `termsCode` and
  `termsCustomDays` on the invoice payload.
- `app/(portal)/portal/invoices/[invoiceId]/page.tsx` — header now shows
  the terms label, the certificates section shows
  `Available` / `Awaiting payment` / `Awaiting release` pills using the
  Phase 1 `reasonCode`, the count summary, and a `Not yet available` chip
  for locked rows.

### Generated
- `lib/admin/master-context.generated.ts` — regenerated via
  `pnpm update:master-context`.

## Architectural decisions

1. **No new migration**. Phase 1 already created every column and the
   junction. Phase 2 is pure wire-up, so the deploy is a release-only
   update with no schema changes — fastest possible rollout.
2. **Reuse `invoice_work_order_links` for traceability**. The repository
   already inserts a row when the legacy `org_invoices.work_order_id` is
   set, so every UI surface keeps using the canonical junction with the
   legacy column merged in for backwards compatibility.
3. **Terms resolution is explicit and transparent**.
   `resolveEffectiveTermsCode()` and `describeTermsResolution()` return
   not just the chosen code but the source (customer override / org
   default / fallback) so UI affordances can explain inheritance —
   matching the pattern used for portal certificate release rules.
4. **No QuickBooks contract changes**. The export in
   `lib/integrations/quickbooks/invoice-sync.ts` continues to send the
   stored `due_date`. Terms only drive due-date computation in the
   creation modal and in the new helpers; QB never sees the terms code,
   so existing line items, customer mapping, and exports are untouched.
5. **Schema-drift safety**. The customer detail page falls back to a
   shorter `select` if `default_invoice_terms_code` is missing, the save
   path retries without the column on `42703` errors, and the new helpers
   surface zero counts on `calibration_records.portal_released_at`
   (Phase 1 column) when missing.
6. **No raw UUIDs in any UI surface**. Work order display uses
   `getWorkOrderDisplay()`, equipment uses `getEquipmentDisplayPrimary()`,
   and invoice numbers come from `org_invoices.invoice_number`. The
   service-source / linked-invoices cards only render text + numbers.

## TODOs / follow-up

- Workspace-level default terms editor under
  `Settings → Billing` (today the column exists but is set via SQL/admin
  only). Mirror the Phase 1/2 portal-cert default UI.
- Surface portal email when an invoice is paid and previously locked
  certificates flip to released — already in the Phase 2 certs TODO list.
- Add a `Linked invoices` tab on the customer detail page showing aging
  buckets across all WOs (currently per-WO only via the drawer).
- Profile-level due-date overrides for customers that pay across
  multiple AP cycles (rare; default falls back to terms today).
- QuickBooks `TermsRef` mapping (optional, customer-controlled) so QB
  invoices honor the same terms code in the QB UI.

## Verification / build status

- `pnpm update:master-context` — regenerated (127 API routes, 98 migrations).
- `pnpm build` — succeeds with no warnings/errors.
- TypeScript strict mode — clean.
- ReadLints across modified files — clean.

## Deploy notes

- No new migration is required. The Phase 1 migration must be applied
  first (it was already applied to deployed databases — this Phase 2
  delivery is pure code).
- Existing invoice/quote workflows are unchanged when no customer or
  workspace terms code is set; the modal still defaults to Net 30.
- Certificate release behavior is unchanged; the portal invoice page only
  re-uses the existing `reasonCode` for clearer pills.
- QuickBooks export continues to use the stored `due_date` exactly as
  before — no change to QB invoice payload.
