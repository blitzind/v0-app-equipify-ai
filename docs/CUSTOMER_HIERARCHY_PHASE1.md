# Customer Hierarchy + Billing/Service Address — Phase 1

Operational improvement aimed at real commercial service accounts (e.g. an
"Acme Hospital System" parent with 12 sub-locations and a separate billing
address). Strictly **additive** — no existing customer table behavior is
changed, no Customers module is rewritten, and QuickBooks/portal sync paths
are untouched.

## Objectives

1. Establish a parent/child relationship between customers in the same org.
2. Surface a lightweight **Hierarchy &amp; addresses** card on customer detail
   and inside the customer drawer.
3. Add child-account and location counts to the customer list/drawer.
4. Clarify **billing** vs **service** addresses everywhere they're shown.
5. Warn — non-blocking — when a customer has no usable billing address before
   creating an invoice or quote.
6. Lay groundwork for future *consolidated reporting by parent account*.

## Architectural decisions

- **Parent linkage uses a single nullable column** on `customers`
  (`parent_customer_id`), referenced via a composite FK
  `(organization_id, parent_customer_id) → (organization_id, id)`. This
  matches the same-org pattern already used by `customer_contacts` and
  `customer_locations`.
- **Cycle protection** is enforced by a Postgres `before insert/update`
  trigger (`customers_prevent_parent_cycle`) capped at 6 hops. The UI maps
  the trigger error into a friendly toast.
- **Billing address is stored inline** on `customers` (10 nullable columns)
  rather than as a separate `customer_locations` row. Existing service
  locations remain untouched; the new `billing_address_same_as_service`
  boolean (default `true`) lets new customers fall back to the default
  service location automatically — preserving today's invoicing behavior.
- **`customer_hierarchy_summary` view** is a read-only convenience layer
  used by the customer list to bulk-fetch `child_count` + `location_count`
  per row without hand-rolling aggregates everywhere. RLS is inherited from
  `public.customers`.
- All new UI is **non-blocking** and **schema-drift safe**: when the
  migration is missing on a target DB the helpers return a softly-degraded
  shape (`schemaMigrationPending = true`) and the card surfaces a small
  inline notice instead of crashing.
- **No raw UUIDs** are exposed in any rendered string. Parent accounts are
  always rendered by `company_name`, deep-link filters use opaque ids in
  query string only.

## Files changed / added

### Migration

- `supabase/migrations/20260721120000_customer_hierarchy_phase1.sql` (new)
  - Adds `parent_customer_id`, billing fields, cycle trigger, and the
    read-only `customer_hierarchy_summary` view.

### Library

- `lib/customers/postgrest-fallback.ts` (new) — column + view absence
  detectors used by hierarchy helpers.
- `lib/customers/hierarchy.ts` (new) — `loadCustomerHierarchy`,
  `loadHierarchySummariesForList`, `formatBillingAddressLine`,
  `formatServiceAddressLine`.
- `lib/customers/consolidated-rollup.ts` (new) — `loadCustomerRollupTree`
  and `resolveCustomerRollupRoot` for future parent-account reporting.

### Components

- `components/customers/customer-hierarchy-card.tsx` (new) — compact card
  rendered in both the customer detail page and the drawer; supports an
  optional **Manage** CTA for owners/admins/managers.
- `components/customers/manage-hierarchy-dialog.tsx` (new) — focused
  modal for setting the parent account and explicit billing address. Uses
  the existing `customers` row update path; same-org / cycle constraints
  are enforced server-side.

### Pages / drawers

- `app/(dashboard)/customers/page.tsx`
  - Loads hierarchy summaries via `loadHierarchySummariesForList`.
  - Adds `Parent · N` badge and *Sub-account of …* line in both card and
    table views.
  - Supports `?parent=<customerId>` deep-link filter (with a clear chip)
    so the Hierarchy card's "View all" link opens a scoped customer list.
- `app/(dashboard)/customers/[id]/page.tsx`
  - Renders the hierarchy card on the Overview tab and labels the locations
    card "Service locations" with a one-line helper clarifying its role.
  - Wires the `ManageHierarchyDialog`.
- `components/drawers/customer-drawer.tsx`
  - Mounts the hierarchy card inside the drawer (compact `drawer` variant).

### Invoice / quote modals

- `components/invoices/new-invoice-modal.tsx` — soft warning under the
  Customer select when the chosen customer has no usable billing address.
- `components/quotes/new-quote-modal.tsx` — same warning.

## Backwards compatibility

| Surface | Behavior on legacy DB (no migration) |
| --- | --- |
| Customer list | Renders normally; hierarchy badges hidden. |
| Customer detail | Hierarchy card shows a small "fields not yet available" notice; rest of page unchanged. |
| Drawer | Hierarchy card slot shows the same notice. |
| Invoice/quote modals | Banner stays hidden. |
| QuickBooks / portal sync | Untouched — no new fields are read by sync paths. |

## Migration / deploy notes

1. Apply `supabase/migrations/20260721120000_customer_hierarchy_phase1.sql`
   in each environment (dev → staging → prod). The migration is idempotent
   and uses guarded `do $$ ... $$` blocks for constraints.
2. No data backfill required. All new columns are nullable / safely
   defaulted; `billing_address_same_as_service` defaults to `true` so legacy
   rows immediately read the same billing address they did before (the
   default service location).
3. After deploy, owners/admins/managers can use the new **Manage** button
   on the customer Hierarchy card to link parents and set explicit billing
   addresses.

## Verification

- `pnpm update:master-context` — regenerated `master-context.generated.ts`
  to include the new migration in the manifest.
- `pnpm build` — production build passes (no new TypeScript / lint errors).
- Manual smoke checks:
  - Customers list renders, with `Parent · N` badge for any customer with
    children.
  - Customer detail Overview tab shows the new hierarchy card; **Manage**
    opens the dialog, saving updates the parent and refreshes the card.
  - `?parent=<id>` deep link filters the customer list and shows the chip.
  - Drawer renders the compact card and reflects parent/child changes.
  - Selecting a customer with no billing address in the new-invoice/quote
    modals shows the soft amber banner under the Customer field.

## TODOs (Phase 2+)

- Aggregate work-order/equipment/invoice rollups by parent (consume
  `loadCustomerRollupTree`).
- Optional QuickBooks bill-to override using the new billing fields when
  `billing_address_same_as_service = false`.
- Hierarchy chip on customer detail subheader.
- Surface hierarchy on the portal landing page for customers who manage
  multiple sub-accounts.
