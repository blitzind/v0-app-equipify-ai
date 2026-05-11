# Executive dashboard expansion (Phase 63.2)

Focused **owner/operator visibility** on the staff home dashboard (`/`) using **bounded Supabase head counts** and existing UX patterns — not a second dashboard product.

## What was added

| Metric | Source | Definition |
| --- | --- | --- |
| **Completed this month** | `work_orders` | Status ∈ `completed`, `completed_pending_signature`, `invoiced`; **`completed_at`** in current calendar month (`monthStart`–`monthEnd`, same bounds as other dashboard month logic). |
| **Quote pipeline** | `org_quotes` | Status ∈ `draft`, `sent`, `pending_approval` — aligns with open-quote semantics in `lib/customers/rollup-metrics.ts` (`OPEN_QUOTE_STATUSES`). |
| **Unassigned open work** | `work_orders` | Status ∈ `open`, `scheduled`, `in_progress` **and** `assigned_user_id` IS NULL. |
| **Active PM plans** | `maintenance_plans` | `status = active`, not archived (includes plans regardless of due date). |

## UI

- **`Executive snapshot`** heading above the stat grid for hierarchy (visual + screen readers).
- **Quote pipeline** stat card is rendered **only** when `permissions.canViewQuotes` is true — avoids implying access users do not have (RLS may still return zero rows).
- New operational insights (same rule engine as existing tiles): **unassigned open work** (links to `/dispatch`), **quote pipeline** (links to `/quotes`) when counts &gt; 0.

## KPI alignment

- Does **not** redefine monthly revenue (`monthlyRevenueCents`) or overdue invoice totals — those formulas are unchanged in `use-supabase-dashboard.ts`.
- **Completed this month** uses **`completed_at`**, while revenue widgets still sum labor/parts on rows filtered by **`updated_at`** in-month — intentionally different concepts (cash-flow timing vs. completion timestamp). Documented to prevent apples-to-oranges comparisons in reviews.

## Permissions & entitlements

- No change to API Route Handlers; dashboard reads via **Supabase client + RLS** as before.
- Quote counts respect **`canViewQuotes`** for **whether the card is shown**; data still respects table RLS.
- Plan **`reports_advanced`** is unchanged — not wired on the dashboard in this phase (see `docs/PLAN_ENTITLEMENT_ENFORCEMENT_AUDIT.md`).

## Query / performance

- Four additional **`select(..., { count: 'exact', head: true })`** queries run inside the **existing** `Promise.all` batch with other dashboard metrics — same pattern as Phase 62.2 optimizations (single parallel round-trip).
- No new realtime subscriptions.

## Responsive / mobile

- Stat grid remains **`grid-cols-2 md:grid-cols-3 xl:grid-cols-4`** — additional cards wrap consistently; `StatCard` min-heights unchanged.

## Deferred

- Week-over-week trend arrows on stat cards (would require stored snapshots or extra queries).
- Deep integration visibility tiles (QuickBooks health) — covered elsewhere (`docs/QUICKBOOKS_PRODUCTION_READINESS.md`).
- Server-driven executive digest replacing client aggregates.

## Related docs

- `docs/PERFORMANCE_AND_QUERY_OPTIMIZATION_AUDIT.md` — dashboard query philosophy.
- `docs/ADVANCED_REPORTING_EXPORT_CENTER.md` — CSV/report alignment.
