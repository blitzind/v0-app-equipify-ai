# Customer Hierarchy — Phase 2

Builds on Phase 1's parent/child foundation by surfacing **operational
rollups** and clearer account context across the customer detail page,
drawer, and list. Strictly additive: no schema changes, no rewrites, and
no new "second CRM" surfaces.

## Objectives

1. Parent rollup metrics (children, locations, equipment, open WOs,
   overdue WOs, unpaid + overdue invoice totals, paid 1y).
2. Hierarchy chip in the customer detail header badge row.
3. Child accounts table on the parent customer detail.
4. Parent account card pinned at the top of every sub-account detail.
5. Hierarchy scope filter on the customer list (all / parents /
   sub-accounts / stand-alone).
6. Portal preparation: server-side scope helper that future portal phases
   can adopt without UI changes.

## Architectural decisions

- **No new SQL.** All rollups are computed client-side from existing
  tables (`customer_locations`, `equipment`, `work_orders`, `org_invoices`)
  using bulk `IN (…)` queries scoped by `organization_id`. RLS is
  inherited automatically.
- **Bounded payloads.** Detail rollup loads at most 2,000 work orders and
  2,000 invoice rows per parent — comfortably above any realistic Phase 2
  customer footprint, and avoids count-only PostgREST trips that don't
  expose status totals.
- **Rollup tree reuse.** The new `loadCustomerRollupMetrics` helper
  delegates tree resolution to the Phase 1 `loadCustomerRollupTree`, so
  the depth limit and cycle guard inherited from the DB trigger flow
  through transparently.
- **Schema-drift safe.** Every helper degrades to a single-customer rollup
  on legacy DBs missing `parent_customer_id` (the Phase 1 migration), and
  every component renders a soft empty state instead of throwing.
- **No raw UUIDs in the UI.** All hierarchy chips, sub-account names, and
  card content render company names from the rollup tree. Deep links use
  the customer id only inside the URL.
- **Portal prep is opt-in and inert.** `resolvePortalCustomerScope`
  returns the portal user's single `customer_id` today; a future
  migration can add `portal_users.consolidated_rollup_enabled` and the
  helper will start expanding to the parent's tree. Phase 2 ships no
  portal UI changes.

## Files changed / added

### Library

- `equipify-app/lib/customers/rollup-metrics.ts` (new) — `loadCustomerRollupMetrics`,
  `formatCentsCompact`.
- `equipify-app/lib/portal/customer-rollup-access.ts` (new, server-only) —
  `resolvePortalCustomerScope` (Phase 3+ wiring point).

### Components

- `equipify-app/components/customers/customer-rollup-card.tsx` (new) —
  parent rollup KPI grid + sub-account chip strip.
- `equipify-app/components/customers/child-accounts-card.tsx` (new) —
  direct sub-accounts list with per-row stats and an Add CTA.
- `equipify-app/components/customers/parent-account-card.tsx` (new) —
  pinned parent context for sub-account detail pages.

### Customer detail page

- `equipify-app/app/(dashboard)/customers/[id]/page.tsx`
  - Loads rollup metrics in a separate non-blocking effect when the row
    has children.
  - Adds **Parent · N** / **Sub-account** chips to the header badge row.
  - Mounts `ParentAccountCard` directly under the header for sub-accounts.
  - Mounts `CustomerRollupCard` at the top of the Overview tab for
    parent accounts.
  - Mounts `ChildAccountsCard` in the right column of the Overview tab
    for parent accounts.

### Customer list

- `equipify-app/app/(dashboard)/customers/page.tsx`
  - Adds a **Hierarchy** select (`all` / `parents` / `children` /
    `standalone`).
  - Wires the filter into the existing `useMemo` pipeline alongside the
    Phase 1 `?parent=<id>` deep-link.

## Migrations

**None.** Phase 2 reuses the Phase 1 schema (`parent_customer_id`,
`customer_hierarchy_summary`) entirely.

## Backwards compatibility

| Surface | Behavior on legacy DB (no Phase 1 migration) |
| --- | --- |
| Customer detail | Header chips hide; rollup card hides; child accounts card shows soft "hierarchy not yet available" copy. |
| Customer list filter | Still renders; `parents`/`children`/`standalone` simply match nothing. |
| Portal helper | Returns the portal user's single customer id (today's behavior). |
| QuickBooks / portal sync | Untouched. |

## TODOs (Phase 3+)

- Add `portal_users.consolidated_rollup_enabled` column and a portal
  setting to opt parent-account portal users into consolidated views.
- Extend invoice / WO / equipment portal queries to consume
  `resolvePortalCustomerScope`.
- Server-rendered cached rollup table for very large parents (1000+
  children) — current client-side approach is fine through low-thousands.
- Hierarchy badge on the dispatch board / work-orders list.
- Cross-account rollup filters in `/insights` (revenue, MTTR by parent).

## Verification

- `pnpm update:master-context` — OK.
- `pnpm build` — production build PASSES (no new TypeScript / lint
  errors).
- `ReadLints` clean across all new and touched files.
- Manual smoke checks:
  - Parent customer: Overview shows the rollup card with non-zero values
    when sub-accounts have equipment / WOs / invoices; Sub-accounts card
    lists each child with stats.
  - Sub-account customer: parent card pinned under the header; clicking
    "View parent" opens the parent detail.
  - List filter: switching to "Parent accounts" / "Sub-accounts" /
    "Stand-alone" updates the visible rows; counts reflect correctly.

## Deploy notes

No DB migration required for Phase 2. Deploy is a normal app push. To
verify locally, sign in as an org owner, link two customers via the
existing **Manage** dialog on the hierarchy card, then load the parent's
detail page.
