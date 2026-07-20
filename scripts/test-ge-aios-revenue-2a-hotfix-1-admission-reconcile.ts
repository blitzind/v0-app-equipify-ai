/**
 * GE-AIOS-REVENUE-2A-HOTFIX-1 — Admission reconcile scale certification.
 * Run: pnpm test:ge-aios-revenue-2a-hotfix-1-admission-reconcile
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_REVENUE_2A_HOTFIX_1_QA_MARKER,
  isAdmissionDownstreamReconcileState,
  isAdmissionReconcileCorrectedOutcome,
  planAdmissionDownstreamReconcileBatch,
  REVENUE_PROMOTION_RECONCILE_LIMIT_PER_ORG,
} from "../lib/growth/draft-factory/draft-factory-admission-downstream-reconcile-2a"
import { REVENUE_PROMOTION_RECONCILE_LIMIT_PER_ORG as WAKE_LIMIT } from "../lib/growth/draft-factory/draft-factory-wake-event-types"

const PHASE = "GE-AIOS-REVENUE-2A-HOTFIX-1" as const
const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log(`[${PHASE}] Admission reconcile scale certification`)
console.log(`  QA marker: ${GROWTH_REVENUE_2A_HOTFIX_1_QA_MARKER}`)

assert.equal(REVENUE_PROMOTION_RECONCILE_LIMIT_PER_ORG, 50)
assert.equal(WAKE_LIMIT, 50)
console.log("  ✓ reconcile limit is 50 per org per tick")

const dueStates = Array.from({ length: 25 }, (_, index) => ({
  leadId: `rejected-${index.toString().padStart(2, "0")}`,
  state: "waiting_for_dm",
  updatedAt: `2026-07-20T10:${(index + 1).toString().padStart(2, "0")}:00.000Z`,
}))

const metadataByLead = new Map<string, Record<string, unknown>>(
  dueStates.map((row) => [row.leadId, { admission_state: "rejected" }]),
)

const batch25 = planAdmissionDownstreamReconcileBatch({
  dueStates,
  resolveMetadata: (leadId) => metadataByLead.get(leadId) ?? null,
  limit: REVENUE_PROMOTION_RECONCILE_LIMIT_PER_ORG,
})
assert.equal(batch25.integrityViolations, 25)
assert.equal(batch25.candidates.length, 25)
assert.equal(batch25.remainingAfterCap, 0)
console.log("  ✓ more than 5 violations reconcile in one tick (25/25)")

const dueStates60 = Array.from({ length: 60 }, (_, index) => ({
  leadId: `review-${index.toString().padStart(3, "0")}`,
  state: "waiting_for_dm",
  updatedAt: `2026-07-20T11:${(index % 60).toString().padStart(2, "0")}:00.000Z`,
}))
const metadata60 = new Map(
  dueStates60.map((row) => [row.leadId, { admission_state: "review" }]),
)
const batchCapped = planAdmissionDownstreamReconcileBatch({
  dueStates: dueStates60,
  resolveMetadata: (leadId) => metadata60.get(leadId) ?? null,
})
assert.equal(batchCapped.candidates.length, 50)
assert.equal(batchCapped.remainingAfterCap, 10)
console.log("  ✓ default cap of 50 is enforced")

const acceptedRow = {
  leadId: "accepted-1",
  state: "waiting_for_dm",
  updatedAt: "2026-07-20T12:00:00.000Z",
}
const mixed = planAdmissionDownstreamReconcileBatch({
  dueStates: [
    { leadId: "r1", state: "waiting_for_dm", updatedAt: "2026-07-20T09:00:00.000Z" },
    acceptedRow,
    { leadId: "r2", state: "paused", updatedAt: "2026-07-20T09:01:00.000Z" },
  ],
  resolveMetadata: (leadId) => {
    if (leadId === "accepted-1") return { admission_state: "accepted" }
    if (leadId.startsWith("r")) return { admission_state: "rejected" }
    return null
  },
})
assert.equal(mixed.candidates.length, 1)
assert.equal(mixed.candidates[0]?.leadId, "r1")
assert.equal(mixed.skippedAlreadyCorrect, 1)
console.log("  ✓ accepted downstream rows are not selected for reconcile")

assert.equal(isAdmissionDownstreamReconcileState("waiting_for_dm"), true)
assert.equal(isAdmissionDownstreamReconcileState("paused"), false)
console.log("  ✓ downstream reconcile state filter")

assert.equal(
  isAdmissionReconcileCorrectedOutcome({
    outcome: "terminal_failure",
    nextState: "failed",
  }),
  true,
)
assert.equal(
  isAdmissionReconcileCorrectedOutcome({
    outcome: "duplicate_noop",
    nextState: "waiting_for_dm",
  }),
  false,
)
console.log("  ✓ corrected outcome detection")

const schedulerSource = readSource("lib/growth/draft-factory/draft-factory-due-scheduler-tick.ts")
assert.match(schedulerSource, /REVENUE_PROMOTION_RECONCILE_LIMIT_PER_ORG/)
assert.doesNotMatch(schedulerSource, /MAX_ADMISSION_RECONCILE_PER_ORG\s*=\s*5/)
assert.match(schedulerSource, /buildAdmissionIntegrityReconcileEvidenceFromMetadata/)
assert.match(schedulerSource, /admissionIntegrityReconcile:\s*true/)
assert.match(schedulerSource, /draft_factory_admission_reconcile_batch/)
console.log("  ✓ scheduler uses named limit and lightweight reconcile advance options")

const liveSource = readSource("lib/growth/draft-factory/draft-factory-durable-live.ts")
assert.match(liveSource, /shouldDiscoverDecisionMaker[\s\S]*evidence\.admitted/)
assert.match(liveSource, /!packageIntegrity\.ok/)
console.log("  ✓ reconcile advance path cannot invoke DM/package providers")

console.log(`\n[${PHASE}] PASS — admission reconcile scale certified`)
