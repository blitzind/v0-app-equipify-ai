# Invoicing Phase 3 — Workspace Defaults + Aging Visibility

Phase 3 adds the next layer of billing administration: a workspace-level
default for invoice payment terms, end-to-end invoice aging on the customer
detail page (with parent rollup), invoice list ergonomics, and a safe
QuickBooks `TermsRef` foundation.

All work is **additive only** — no schema migrations, no behavior changes
to existing invoice numbering, certificate release rules, or QuickBooks
sync. The Phase 1 migration `20260719120000_service_lifecycle_phase1.sql`
already provides every column we touch:

- `organizations.default_invoice_terms_code`
- `customers.default_invoice_terms_code`
- `org_invoices.terms_code` / `terms_custom_days`
- `invoice_work_order_links` (consumed by Phase 2 helpers, unchanged here)

## Architectural decisions

1. **No new migrations.** Phase 1 already added the workspace + customer
   defaults columns. Every Phase 3 query attempts the new column and
   gracefully degrades when it is missing.
2. **Pure aging math, ad hoc rollup.** `lib/billing/invoice-aging.ts`
   summarizes a list of `AdminInvoice[]` rows into
   `{ unpaid, overdue, draftPending, paidLast12mo, openBalance, buckets }`.
   The customer detail page reuses the existing repository
   (`fetchInvoicesForOrganization`) and either filters to the customer or
   expands across the rollup tree (`loadCustomerRollupTree` from Phase 1)
   so the parent variant is just `summarizeInvoiceAging(consolidatedRows)`.
3. **Single source of truth for due dates.** `due_date` remains the only
   field consumed by QuickBooks export. `terms_code` only powers UI hints
   and the existing creation-time due date calculation.
4. **QuickBooks TermsRef foundation, not behavior.**
   `quickbooksTermsHintForCode` returns the human label that matches the
   QB online "Terms" presets ("Net 30", "Due on receipt", …). It is *not*
   used by `lib/integrations/quickbooks/invoice-sync.ts` — wiring it
   would require fetching the org's actual Terms catalog from QB and
   mapping by name. We document the hint here so a later phase can
   complete the round-trip safely.
5. **Empty states everywhere.** Customer billing tab calls out missing
   billing addresses *and* missing customer terms. The workspace default
   editor prints whether the workspace falls back to the built-in Net 30.

## Files changed

- `equipify-app/lib/billing/invoice-aging.ts` — new
- `equipify-app/lib/billing/invoice-terms.ts` — added
  `quickbooksTermsHintForCode`
- `equipify-app/components/customers/customer-invoice-aging-card.tsx` — new
- `equipify-app/components/settings/workspace-invoice-defaults-card.tsx` — new
- `equipify-app/app/api/organizations/[organizationId]/billing/default-invoice-terms/route.ts` — new
- `equipify-app/app/(dashboard)/settings/billing/page.tsx` — adds workspace
  defaults card to the top of Settings → Billing
- `equipify-app/app/(dashboard)/customers/[id]/page.tsx` — adds Billing tab
  with single-customer aging, consolidated rollup card, and warning rows
- `equipify-app/app/(dashboard)/invoices/page.tsx` — supports `?customerId=`
  filter from the customer billing tab and adds a "Service-linked" hint
  beneath the work order column
- `equipify-app/lib/admin/master-context.generated.ts` — regenerated

No existing helpers were modified except `invoice-terms.ts`, which is
strictly additive.

## TODOs / future work

- **QuickBooks `TermsRef` end-to-end sync.** Add a per-org cached Terms
  catalog from `/v3/company/.../query?query=select * from term`, map by
  name using `quickbooksTermsHintForCode`, and inject `TermsRef` into the
  invoice payload built by `invoice-sync.ts`. This must be feature
  flagged because it changes the QB write payload.
- **Invoice list pagination + filtering.** The customer-scoped link
  (`/invoices?customerId=…`) reuses the in-memory list; if invoice
  volume grows we should push the filter down to the repository.
- **Aging cache on the customer index.** The Phase 3 effect issues one
  Supabase query per customer detail load. A shared rollup view (or a
  cached aging table) would reduce repeat work for parent accounts.

## Verification

- `pnpm update:master-context` — passes (128 API routes, 98 migrations).
- `pnpm build` — passes (production build, no TypeScript / lint errors).
- Schema-drift safety: every new helper either falls back to the legacy
  shape (settings card surfaces a "schemaMigrationPending" hint) or
  returns an empty summary when the Phase 1 migration is absent.

## Deploy notes

- No migration deployment required.
- Owners + admins immediately gain access to the workspace default
  editor (`canEditOrgBilling`). Other roles see the editor in read-only
  mode.
- The customer Billing tab and consolidated rollup are visible to every
  role that can already see customer detail pages.
