/**
 * GE-AIOS-REVENUE-2A-HOTFIX-3 — Admission reconcile scheduler order repair.
 * Run: pnpm test:ge-aios-revenue-2a-hotfix-3-admission-reconcile-scheduler-order
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  evaluateAdmissionDownstreamReconcileNeed,
  GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_PHASE_ORDER_HOTFIX_3,
  GROWTH_REVENUE_2A_HOTFIX_2_QA_MARKER,
  GROWTH_REVENUE_2A_HOTFIX_3_QA_MARKER,
  isAdmissionReconcileCorrectedOutcome,
} from "../lib/growth/draft-factory/draft-factory-admission-downstream-reconcile-2a"
import {
  advanceDraftFactoryForLead,
  listAdmissionIntegrityReconcileDraftFactoryStates,
} from "../lib/growth/draft-factory/draft-factory-durable-service"
import { createMemoryDraftFactoryRepository } from "../lib/growth/draft-factory/draft-factory-durable-memory-repository"
import { emptyAttemptCounts } from "../lib/growth/draft-factory/draft-factory-durable-types"
import { upsertDurableDraftFactoryLeadState } from "../lib/growth/draft-factory/draft-factory-durable-store"
import { REVENUE_PROMOTION_RECONCILE_LIMIT_PER_ORG } from "../lib/growth/draft-factory/draft-factory-wake-event-types"

const PHASE = "GE-AIOS-REVENUE-2A-HOTFIX-3" as const
const ORG = "org-hotfix-3"
const NOW = "2026-07-20T12:00:00.000Z"
const FUTURE_WAKE = "2099-01-01T00:00:00.000Z"
const SCHEDULER_BUDGET_MS = 15_000

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function indexOfOrFail(source: string, needle: string, label: string): number {
  const index = source.indexOf(needle)
  assert.ok(index >= 0, `${label} not found: ${needle}`)
  return index
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

function remainingBudgetMs(startedAt: number, maxRuntimeMs: number): number {
  return Math.max(0, maxRuntimeMs - (Date.now() - startedAt))
}

console.log(`[${PHASE}] Admission reconcile scheduler order repair`)
console.log(`  QA marker: ${GROWTH_REVENUE_2A_HOTFIX_3_QA_MARKER}`)
console.log(`  HOTFIX-2 marker: ${GROWTH_REVENUE_2A_HOTFIX_2_QA_MARKER}`)

async function main(): Promise<void> {
  const schedulerSource = readSource("lib/growth/draft-factory/draft-factory-due-scheduler-tick.ts")

  assert.deepEqual(GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_PHASE_ORDER_HOTFIX_3, [
    "load_due_pool",
    "load_reconcile_pool",
    "admission_reconcile",
    "datamoon_dm_poll",
    "classification",
    "enrichment",
    "portfolio_selection",
    "lead_advancement",
    "generation_capacity",
    "telemetry",
  ])
  console.log("  ✓ documented HOTFIX-3 phase order constant")

  const reconcileCallIndex = indexOfOrFail(
    schedulerSource,
    "runAdmissionIntegrityReconcileForOrganization(admin",
    "reconcile helper invocation",
  )
  const classificationIndex = indexOfOrFail(
    schedulerSource,
    "planFairDueCapacityClassAdmission({",
    "classification phase",
  )
  const portfolioIndex = indexOfOrFail(
    schedulerSource,
    "selectPortfolioAwareDueDraftFactoryStates({",
    "portfolio selection phase",
  )
  const advancementIndex = indexOfOrFail(
    schedulerSource,
    "sourceId: `due:${organizationId}:${leadId}:${now}:${capacityClass",
    "lead advancement phase",
  )
  const generationIndex = indexOfOrFail(
    schedulerSource,
    "advanceDraftFactoryCapacityWake({",
    "generation capacity phase",
  )

  assert.ok(reconcileCallIndex < classificationIndex, "reconcile must run before classification")
  assert.ok(reconcileCallIndex < portfolioIndex, "reconcile must run before portfolio selection")
  assert.ok(reconcileCallIndex < advancementIndex, "reconcile must run before lead advancement")
  assert.ok(reconcileCallIndex < generationIndex, "reconcile must run before generation capacity")
  assert.doesNotMatch(
    schedulerSource.slice(advancementIndex),
    /runAdmissionIntegrityReconcileForOrganization/,
  )
  console.log("  ✓ reconcile executes before portfolio advancement and generation work")

  assert.match(schedulerSource, /draft_factory_admission_reconcile_started/)
  assert.match(schedulerSource, /draft_factory_admission_reconcile_completed/)
  assert.match(schedulerSource, /budget_remaining_before_reconcile_ms/)
  assert.match(schedulerSource, /budget_remaining_after_reconcile_ms/)
  assert.match(schedulerSource, /reconcile_started/)
  assert.match(schedulerSource, /reconcile_completed/)
  console.log("  ✓ HOTFIX-3 telemetry fields present in scheduler")

  assert.equal(REVENUE_PROMOTION_RECONCILE_LIMIT_PER_ORG, 50)
  assert.match(schedulerSource, /maxRuntimeMs \?\? 15_000/)
  assert.doesNotMatch(schedulerSource, /maxRuntimeMs \?\? 30_000/)
  console.log("  ✓ existing 15s scheduler budget preserved (not increased)")

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

  const reconcilePool = await listAdmissionIntegrityReconcileDraftFactoryStates({
    organizationId: ORG,
    repository: repo,
  })
  assert.equal(reconcilePool.length, 22)

  const metadataByLead = new Map<string, Record<string, unknown>>()
  for (let index = 0; index < 20; index += 1) {
    metadataByLead.set(`rejected-dm-${index.toString().padStart(2, "0")}`, { admission_state: "rejected" })
  }
  metadataByLead.set("review-dm-01", { admission_state: "review" })
  metadataByLead.set("accepted-dm-01", { admission_state: "accepted" })

  const violationRows = reconcilePool
    .map((row) => ({
      row,
      need: evaluateAdmissionDownstreamReconcileNeed({
        metadata: metadataByLead.get(row.leadId) ?? null,
      }),
    }))
    .filter(({ need }) => need.needsReconcile)

  assert.equal(violationRows.length, 21)
  assert.ok(!violationRows.some(({ row }) => row.leadId === "accepted-dm-01"))
  console.log("  ✓ 21 reconcile candidates discovered (accepted lead excluded)")

  const startedAtFresh = Date.now()
  assert.ok(remainingBudgetMs(startedAtFresh, SCHEDULER_BUDGET_MS) > 0)
  let attemptedFresh = 0
  let correctedFresh = 0
  for (const { row } of violationRows.slice(0, REVENUE_PROMOTION_RECONCILE_LIMIT_PER_ORG)) {
    if (remainingBudgetMs(startedAtFresh, SCHEDULER_BUDGET_MS) <= 0) break
    attemptedFresh += 1
    const result = await advanceDraftFactoryForLead({
      organizationId: ORG,
      leadId: row.leadId,
      wake: {
        type: "scheduled_resume",
        sourceId: `reconcile:admission:${ORG}:${row.leadId}:${NOW}`,
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
    if (
      isAdmissionReconcileCorrectedOutcome({
        outcome: result.outcome,
        nextState: result.nextState,
      })
    ) {
      correctedFresh += 1
    }
  }
  assert.equal(attemptedFresh, 21)
  assert.equal(correctedFresh, 21)
  console.log("  ✓ fresh budget: 21 attempted and 21 corrected (production failure shape cleared)")

  const startedAtStarved = Date.now() - SCHEDULER_BUDGET_MS - 1
  assert.equal(remainingBudgetMs(startedAtStarved, SCHEDULER_BUDGET_MS), 0)
  let attemptedStarved = 0
  for (const { row } of violationRows.slice(0, REVENUE_PROMOTION_RECONCILE_LIMIT_PER_ORG)) {
    if (remainingBudgetMs(startedAtStarved, SCHEDULER_BUDGET_MS) <= 0) break
    attemptedStarved += 1
    await advanceDraftFactoryForLead({
      organizationId: ORG,
      leadId: row.leadId,
      wake: {
        type: "scheduled_resume",
        sourceId: `reconcile:admission:${ORG}:${row.leadId}:${NOW}`,
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
  }
  assert.equal(attemptedStarved, 0)
  console.log("  ✓ exhausted budget yields attempted=0 (HOTFIX-2 starvation shape reproduced)")

  const acceptedAfter = await listAdmissionIntegrityReconcileDraftFactoryStates({
    organizationId: ORG,
    repository: repo,
  })
  assert.ok(acceptedAfter.some((row) => row.leadId === "accepted-dm-01"))
  console.log("  ✓ accepted lead remains in downstream state (never terminaled by reconcile)")

  const reconcileFn =
    schedulerSource.match(
      /async function runAdmissionIntegrityReconcileForOrganization[\s\S]*?\n\}(?=\n\nexport async function tickDraftFactoryDueStatesForScheduler)/,
    )?.[0] ?? ""
  assert.match(reconcileFn, /completionHints:\s*\{\s*admissionIntegrityReconcile:\s*true\s*\}/)
  assert.match(schedulerSource, /selectPortfolioAwareDueDraftFactoryStates/)
  assert.match(schedulerSource, /advanceDraftFactoryCapacityWake/)
  console.log("  ✓ safe reconcile options preserved; portfolio and generation phases still wired")

  console.log(`\n[${PHASE}] PASS — admission reconcile scheduler order certified`)
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
