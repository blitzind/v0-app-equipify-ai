/**
 * Deterministic checks for operational timeline intelligence (no DB).
 * Run: pnpm exec tsx scripts/test-operational-timeline-intelligence.ts
 */
import assert from "node:assert/strict"
import { buildOperationalTimelineIntelligenceFromRows } from "../lib/aiden/operational-timeline-intelligence"
import type { TimelineWorkOrderRow } from "../lib/aiden/operational-timeline-intelligence"

const iso = (d: string) => `${d}T12:00:00Z`

const rows: TimelineWorkOrderRow[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    equipment_id: "00000000-0000-4000-8000-0000000000e1",
    customer_id: "00000000-0000-4000-8000-0000000000c1",
    title: "Walk-in cooler — emergency call",
    status: "completed",
    priority: "high",
    type: "emergency",
    scheduled_on: "2026-01-10",
    completed_at: "2026-01-10",
    created_at: iso("2026-01-10"),
    updated_at: iso("2026-01-10"),
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    equipment_id: "00000000-0000-4000-8000-0000000000e1",
    customer_id: "00000000-0000-4000-8000-0000000000c1",
    title: "Cooler not holding temp",
    status: "open",
    priority: "critical",
    type: "emergency",
    scheduled_on: "2026-02-15",
    completed_at: null,
    created_at: iso("2026-02-12"),
    updated_at: iso("2026-02-12"),
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    equipment_id: "00000000-0000-4000-8000-0000000000e1",
    customer_id: "00000000-0000-4000-8000-0000000000c1",
    title: "Quarterly PM",
    status: "completed",
    priority: "medium",
    type: "pm",
    scheduled_on: "2026-01-01",
    completed_at: "2026-01-01",
    created_at: iso("2026-01-01"),
    updated_at: iso("2026-01-01"),
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    equipment_id: "00000000-0000-4000-8000-0000000000e1",
    customer_id: "00000000-0000-4000-8000-0000000000c1",
    title: "Quarterly PM follow-up",
    status: "scheduled",
    priority: "medium",
    type: "pm",
    scheduled_on: "2026-03-01",
    completed_at: null,
    created_at: iso("2026-02-20"),
    updated_at: iso("2026-02-20"),
  },
  {
    id: "00000000-0000-4000-8000-000000000005",
    equipment_id: "00000000-0000-4000-8000-0000000000e2",
    customer_id: "00000000-0000-4000-8000-0000000000c1",
    title: "Rental turnaround inspection",
    status: "scheduled",
    priority: "medium",
    type: "inspection",
    scheduled_on: "2025-12-01",
    completed_at: null,
    created_at: iso("2025-11-28"),
    updated_at: iso("2025-11-28"),
  },
]

const intel = buildOperationalTimelineIntelligenceFromRows(rows, {
  industryKey: "refrigeration_service",
  generatedAtIso: iso("2026-05-01"),
  createdAfterUtc: iso("2025-01-01"),
  rowLimit: 400,
})

assert.ok(intel.methodology.length >= 5)
assert.ok(intel.operationalTrendTimelines[0]?.points.length >= 1)

const emChains = intel.recurringIssueChains.filter((c) => c.chainKind === "emergency_repeat_same_equipment")
assert.ok(emChains.length >= 1, "expected emergency repeat chain")

const pmChains = intel.recurringIssueChains.filter((c) => c.chainKind === "pm_recurrence_same_equipment")
assert.ok(pmChains.length >= 1, "expected pm recurrence chain")

const esc = intel.escalationSequences
assert.ok(esc.length >= 1, "expected priority escalation")

const insp = intel.operationalEvents.some((e) =>
  e.correlationRuleIds.includes("RULE.INSPECTION_SCHEDULE_SLIP_ACTIVE"),
)
assert.ok(insp, "expected inspection slip event")

assert.ok(intel.deterministicCrossReads?.length === 2)

console.log("operational-timeline-intelligence tests passed.")
