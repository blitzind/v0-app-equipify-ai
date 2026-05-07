# Equipment history & compliance intelligence — Phase 1

## Summary

Phase 1 makes the **equipment record** more asset-centric: taxonomy fields, compliance placeholders, a **unified equipment timeline**, **revenue and technician rollups** on the equipment detail page, **merged work order history** (primary `equipment_id` + `work_order_equipment`), **invoice and certificate** linkage, **list filters** (maintenance / calibration / warranty), and **customer-level compliance hints** on the customer overview.

## Database

**Migration:** `supabase/migrations/20260720120000_equipment_intelligence_phase1.sql`

- `equipment.subcategory` — optional refinement under `category` (hierarchical reporting without a new taxonomy table).
- `equipment.calibration_interval_months` — optional planned interval.
- `equipment.next_calibration_due_at` — compliance/calibration due date.
- Check: `calibration_interval_months` null or **> 0**.
- Indexes: `(organization_id, category, subcategory)`, `(organization_id, next_calibration_due_at)` filtered, `(organization_id, manufacturer)` filtered.

Existing rows remain valid; new columns are nullable.

## Code layout

| Area | Files |
|------|--------|
| Timeline builder | `lib/lifecycle/equipment-timeline.ts` |
| Batched queries (WO merge, invoices, certs) | `lib/equipment/equipment-detail-queries.ts` |
| Search | `lib/equipment/display.ts` — `subcategory`, `manufacturer` in `equipmentMatchesSearch` |
| Equipment detail | `app/(dashboard)/equipment/[id]/page.tsx` |
| Equipment list | `app/(dashboard)/equipment/page.tsx` |
| Add equipment | `components/equipment/add-equipment-modal.tsx` |
| Customer overview KPI | `app/(dashboard)/customers/[id]/page.tsx` |
| Types | `lib/mock-data.ts` — optional `subcategory`, `nextCalibrationDue`, `calibrationIntervalMonths` on `Equipment` |

## TODO — later phases

- Dedicated `equipment_categories` table with parent/child FKs and admin UI.
- Revenue by category / manufacturer **reports** (SQL views or materialized aggregates).
- Portal equipment detail: align with dashboard timeline payloads (`/api/portal/equipment/[id]`).
- Inventory: explicit **parts ↔ equipment** consumption rows if not fully captured in work order economics.
- Predictive maintenance / AI signals on top of stored timeline facts.
- Parent/child **customer hierarchy** rollups for equipment (when hierarchy data is consistently populated).

## Verification

- `npm run build` (equipify-app) passes.
