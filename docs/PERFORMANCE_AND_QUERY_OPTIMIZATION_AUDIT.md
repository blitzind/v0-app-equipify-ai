# Performance & query optimization audit (Phase 62.2)

Conservative pass focused on **dashboard Supabase usage** and **Insights load**. Org scoping, RLS, and Route Handler permission checks are unchanged — only browser-side query shapes and parallel work were tuned.

## Hotspots found

| Area | Issue |
| --- | --- |
| Home dashboard hook (`useSupabaseDashboard`) | Many **count-only** queries used `select('*', head: true)` — unnecessary projection hint |
| Same hook | **Accounts receivable:** fetched all `sent`/`unpaid`/`overdue` invoices then filtered overdue in JS — oversized payloads on large AR lists |
| **`/insights`** | Mounted the **full** dashboard loader including recent work orders (join prep), equipment-due **list**, warranty **list** — unused on Insights UI |

## Optimizations made

1. **Head counts:** Count queries now use `select('id', { count: 'exact', head: true })` instead of `*` for equipment, work orders, and maintenance plans counts (same counts, clearer intent).
2. **Overdue invoices:** Server-side filter matches prior behavior: `(status = overdue AND due_date IS NULL) OR (due_date < today)` via `.or(...)`, then aggregate amounts without a second client filter pass.
3. **Insights variant:** `useSupabaseDashboard({ variant: 'insights' })` skips the three expensive **list** branches (equipment due preview rows, warranty preview rows, recent work orders + related customer/equipment/profile lookups). Stats, charts, repeat-repair logic, and operational insight generation stay aligned with the home dashboard.

## Intentionally deferred

- **Reports page:** Uses both `useSupabaseDashboard()` and `useWorkspaceData()` — overlapping workspace mocks/live paths; consolidating risks behavior drift → separate phase.
- **Inventory six-way parallel fetch:** Already bounded limits on some routes; broader API pagination refactor out of scope.
- **Work order drawer `select('*')`:** High-impact surface; only touch with explicit column inventory per domain row.
- **Dynamic imports for `recharts`:** Would shrink bundles but needs UX/load testing per route.
- **Offline replay / IndexedDB:** No changes — correctness-first.

## Safeguards (unchanged)

- All queries remain **`organization_id`-scoped** through the Supabase client session + RLS.
- No relaxation of `requireOrgPermission` / entitlements for speed.
- Demo/sample org behavior unchanged.
