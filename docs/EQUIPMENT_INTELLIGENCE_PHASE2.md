# Equipment Intelligence — Phase 2

## Goal

Surface equipment-centric operational intelligence so service businesses can
understand revenue, workload, and service trends by equipment type/category —
on the equipment list/detail, customer detail, and reports pages.

This is **additive only**. No new migrations, no rewrites. Phase 2 builds on
the schema and helpers introduced in Phase 1 (`subcategory`,
`next_calibration_due_at`, `calibration_interval_months`, equipment timeline,
batched detail queries).

## Architectural decisions

- **Single rollup helper** (`lib/equipment/intelligence-rollup.ts`) is reused
  on equipment list, equipment detail, customer detail, and the reports page.
  No parallel reporting systems.
- **Schema-drift safe.** Both helpers (`loadEquipmentCategoryBreakdown`,
  `loadEquipmentSignalsByIds`) tolerate missing Phase 1 columns by retrying
  with a legacy select (`isEquipmentListSchemaMismatchError`).
- **Tenant-scoped queries.** Every query filters by `organization_id`; RLS
  inheritance is preserved.
- **Hierarchy-aware on customer detail.** When the customer has sub-accounts,
  the breakdown uses `loadCustomerRollupTree` (depth-capped at 6) to expand
  to parent + descendants. Standalone/child customers stay scoped to self.
- **No raw UUIDs in UI.** All display strings use friendly labels
  (category names, sub-account counts).
- **Performance budget.** Equipment list signals are loaded in a single bulk
  query for up to 250 visible rows; reports breakdown runs as one extra
  query in parallel with the existing analytics endpoint.

## Files added

| File | Purpose |
|---|---|
| `lib/equipment/intelligence-rollup.ts` | Reusable helpers: `loadEquipmentCategoryBreakdown` and `loadEquipmentSignalsByIds` (+ `formatCentsCompact`). |
| `components/equipment/equipment-category-breakdown-card.tsx` | Compact category table card (equipment, open WOs, upcoming due, completed, revenue). |
| `components/equipment/equipment-signals-row.tsx` | Inline strip of operational chips (warranty, service due, repeat-repair, open WOs, history). |
| `docs/EQUIPMENT_INTELLIGENCE_PHASE2.md` | This file. |

## Files updated

| File | Change |
|---|---|
| `app/(dashboard)/equipment/page.tsx` | Loads bulk signals for the visible equipment rows and renders `EquipmentSignalsRow` in both table and card views. |
| `app/(dashboard)/equipment/[id]/page.tsx` | Loads per-equipment signals on detail and renders the chip row under the status badge. |
| `app/(dashboard)/customers/[id]/page.tsx` | Loads `loadEquipmentCategoryBreakdown` for the customer (or full rollup tree on parents) and renders `EquipmentCategoryBreakdownCard` on the Overview tab. |
| `app/(dashboard)/reports/page.tsx` | New "Equipment Intelligence" section: org-wide breakdown including revenue + upcoming due, scoped by selected customer/category filters. |

## Migrations

**None.** Phase 2 is purely client-side helpers + UI components reusing the
Phase 1 schema. Apply `20260720120000_equipment_intelligence_phase1.sql` if
you have not already (otherwise `next_calibration_due_at` is auto-skipped).

## TODOs (later phases)

- Server-side `equipment_category_summary` view for very large tenants
  (current client-side aggregation is fine up to ~5k equipment rows).
- Equipment manufacturer breakdown alongside category.
- Predictive flags ("likely to fail in 30d") layered on top of repeat-repair
  signal.
- Portal: equipment-intelligence summary (gated behind portal feature flags).
- Inventory cost rollups joined with consumed parts to refine revenue.

## Backwards compatibility

- Drops nothing.
- All new components no-op cleanly when their data is `null`/empty (loading,
  error, missing migration).
- Equipment list signals query is capped at 250 ids and falls back silently
  on schema drift.
- Customer detail breakdown gracefully handles missing hierarchy view.

## Verification

- `pnpm update:master-context` regenerates `lib/admin/master-context.generated.ts` (no other manual updates needed).
- `pnpm build` passes.
- Manually verify on:
  - Equipment list (table + card view) — chips appear under model row.
  - Equipment detail — chip strip appears beneath the status badge.
  - Customer detail (Overview tab) — "Equipment intelligence" card renders for any customer with equipment; parent accounts roll up to include sub-accounts.
  - Reports — "Equipment Intelligence" section renders below the existing tables row, respects the customer + category filters, and degrades to an empty state when no equipment is in scope.
