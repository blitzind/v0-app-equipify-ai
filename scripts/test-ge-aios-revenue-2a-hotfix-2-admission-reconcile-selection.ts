/**
 * GE-AIOS-REVENUE-2A-HOTFIX-2 — Admission reconcile candidate selection repair.
 * Run: pnpm test:ge-aios-revenue-2a-hotfix-2-admission-reconcile-selection
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  evaluateAdmissionDownstreamReconcileNeed,
  GROWTH_REVENUE_2A_HOTFIX_2_QA_MARKER,
  isAdmissionReconcileCorrectedOutcome,
  planAdmissionDownstreamReconcileBatch,
  REVENUE_PROMOTION_RECONCILE_LIMIT_PER_ORG,
} from "../lib/growth/draft-factory/draft-factory-admission-downstream-reconcile-2a"
import {
  advanceDraftFactoryForLead,
  listAdmissionIntegrityReconcileDraftFactoryStates,
  listDueDraftFactoryStates,
} from "../lib/growth/draft-factory/draft-factory-durable-service"
import { createMemoryDraftFactoryRepository } from "../lib/growth/draft-factory/draft-factory-durable-memory-repository"
import { emptyAttemptCounts } from "../lib/growth/draft-factory/draft-factory-durable-types"
import { upsertDurableDraftFactoryLeadState } from "../lib/growth/draft-factory/draft-factory-durable-store"

const PHASE = "GE-AIOS-REVENUE-2A-HOTFIX-2" as const
const ORG = "org-hotfix-2"
const NOW = "2026-07-20T12:00:00.000Z"
const FUTURE_WAKE = "2099-01-01T00:00:00.000Z"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function seedRow(input: {
  leadId: string
  state: string
  updatedAt: string
  nextEligibleWakeAt?: string | null
}) {
  upsertDurableDraftFactoryLeadState({
    organizationId: ORG,
    leadId: input.leadId,
    state: input.state as "waiting_for_dm",
    earliestIncompleteStage: "decision_maker",
    version: 1,
    packageId: null,
    researchRunId: "run-1",
    decisionMakerId: null,
    personalizationId: null,
    lastWakeType: null,
    lastWakeAt: null,
    nextEligibleWakeAt: input.nextEligibleWakeAt ?? FUTURE_WAKE,
    attemptCounts: emptyAttemptCounts(),
    lastErrorCode: null,
    lastErrorStage: null,
    pausedReason: null,
    leaseOwner: null,
    leaseExpiresAt: null,
    createdAt: input.updatedAt,
    updatedAt: input.updatedAt,
  })
}

console.log(`[${PHASE}] Admission reconcile candidate selection repair`)
console.log(`  QA marker: ${GROWTH_REVENUE_2A_HOTFIX_2_QA_MARKER}`)

async function main(): Promise<void> {
const repo = createMemoryDraftFactoryRepository("memory")

for (let index = 0; index < 20; index += 1) {
  seedRow({
    leadId: `rejected-dm-${index.toString().padStart(2, "0")}`,
    state: "waiting_for_dm",
    updatedAt: `2026-07-01T10:${index.toString().padStart(2, "0")}:00.000Z`,
  })
}
seedRow({
  leadId: "review-dm-01",
  state: "waiting_for_dm",
  updatedAt: "2026-07-01T09:00:00.000Z",
})
seedRow({
  leadId: "accepted-dm-01",
  state: "waiting_for_dm",
  updatedAt: "2026-07-01T08:00:00.000Z",
})

const duePool = await listDueDraftFactoryStates({
  organizationId: ORG,
  now: NOW,
  repository: repo,
})
const dueDmViolations = duePool.filter((row) => row.state === "waiting_for_dm")
assert.equal(dueDmViolations.length, 0, "future wake due pool must exclude waiting_for_dm rows")
console.log("  ✓ ordinary due pool excludes future-wake waiting_for_dm rows")

const reconcilePool = await listAdmissionIntegrityReconcileDraftFactoryStates({
  organizationId: ORG,
  repository: repo,
})
assert.equal(reconcilePool.length, 22)
console.log("  ✓ wake-independent reconcile scan returns all downstream rows")

const metadataByLead = new Map<string, Record<string, unknown>>()
for (let index = 0; index < 20; index += 1) {
  metadataByLead.set(`rejected-dm-${index.toString().padStart(2, "0")}`, { admission_state: "rejected" })
}
metadataByLead.set("review-dm-01", { admission_state: "review" })
metadataByLead.set("accepted-dm-01", { admission_state: "accepted" })

const plan = planAdmissionDownstreamReconcileBatch({
  dueStates: reconcilePool.map((row) => ({
    leadId: row.leadId,
    state: row.state,
    updatedAt: row.updatedAt,
  })),
  resolveMetadata: (leadId) => metadataByLead.get(leadId) ?? null,
})
assert.equal(plan.integrityViolations, 21)
assert.equal(plan.candidates.length, 21)
assert.equal(plan.remainingAfterCap, 0)
assert.ok(!plan.candidates.some((row) => row.leadId === "accepted-dm-01"))
console.log("  ✓ 21 violations selected in one tick; accepted row excluded")

assert.equal(REVENUE_PROMOTION_RECONCILE_LIMIT_PER_ORG, 50)
const capped = planAdmissionDownstreamReconcileBatch({
  dueStates: Array.from({ length: 60 }, (_, index) => ({
    leadId: `bulk-${index}`,
    state: "waiting_for_dm",
    updatedAt: `2026-07-01T10:${(index % 60).toString().padStart(2, "0")}:00.000Z`,
  })),
  resolveMetadata: () => ({ admission_state: "rejected" }),
})
assert.equal(capped.candidates.length, 50)
assert.equal(capped.remainingAfterCap, 10)
console.log("  ✓ cap of 50 still enforced")

const rejectedNeed = evaluateAdmissionDownstreamReconcileNeed({
  metadata: { admission_state: "rejected" },
})
assert.equal(rejectedNeed.needsReconcile, true)

const withoutBypass = await advanceDraftFactoryForLead({
  organizationId: ORG,
  leadId: "rejected-dm-00",
  wake: "scheduled_resume",
  now: NOW,
  repository: repo,
  evidence: {
    admitted: false,
    researchCurrent: true,
    knowledgeComplete: true,
    stopInvestment: false,
    portfolioSelected: false,
    decisionMakerAvailable: true,
    contactVerifiedForEmail: false,
    personalizationReady: false,
    draftValid: false,
    approved: false,
    rejected: true,
    failed: false,
  },
})
assert.equal(withoutBypass.outcome, "waiting")
assert.equal(withoutBypass.nextState, "waiting_for_dm")
console.log("  ✓ retry gate blocks ordinary advance on future wake")

const withBypass = await advanceDraftFactoryForLead({
  organizationId: ORG,
  leadId: "rejected-dm-01",
  wake: {
    type: "scheduled_resume",
    sourceId: `reconcile:admission:${ORG}:rejected-dm-01:${NOW}`,
  },
  now: NOW,
  repository: repo,
  evidence: {
    admitted: false,
    researchCurrent: true,
    knowledgeComplete: true,
    stopInvestment: false,
    portfolioSelected: false,
    decisionMakerAvailable: true,
    contactVerifiedForEmail: false,
    personalizationReady: false,
    draftValid: false,
    approved: false,
    rejected: true,
    failed: false,
  },
  completionHints: { admissionIntegrityReconcile: true },
})
assert.equal(withBypass.outcome, "terminal_failure")
assert.equal(withBypass.nextState, "failed")
assert.equal(
  isAdmissionReconcileCorrectedOutcome({
    outcome: withBypass.outcome,
    nextState: withBypass.nextState,
  }),
  true,
)
console.log("  ✓ integrity reconcile bypass terminals rejected waiting_for_dm to failed")

const correctedPool = await listAdmissionIntegrityReconcileDraftFactoryStates({
  organizationId: ORG,
  repository: repo,
})
assert.ok(!correctedPool.some((row) => row.leadId === "rejected-dm-01"))
console.log("  ✓ corrected row leaves reconcile scan pool")

const schedulerSource = readSource("lib/growth/draft-factory/draft-factory-due-scheduler-tick.ts")
const repositorySource = readSource("lib/growth/draft-factory/draft-factory-durable-repository-core.ts")
assert.match(schedulerSource, /listAdmissionIntegrityReconcileDraftFactoryStates/)
assert.match(schedulerSource, /admissionIntegrityReconcile:\s*true/)
assert.doesNotMatch(schedulerSource, /for \(const row of dueStates\) \{[\s\S]*violationRows/)
assert.match(repositorySource, /listAdmissionIntegrityReconcileStates/)
assert.doesNotMatch(repositorySource, /listAdmissionIntegrityReconcileStates[\s\S]*next_eligible_wake_at/)
console.log("  ✓ scheduler uses wake-independent scan and reconcile bypass hint")

console.log(`\n[${PHASE}] PASS — reconcile candidate selection repair certified`)
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
