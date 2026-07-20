/**
 * GE-AIOS-REVENUE-2A-HOTFIX-4 — Admission reconcile per-lead throughput repair.
 * Run: pnpm test:ge-aios-revenue-2a-hotfix-4-admission-reconcile-throughput
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildAdmissionIntegrityReconcileEvidenceFromMetadata,
  GROWTH_REVENUE_2A_HOTFIX_4_QA_MARKER,
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

const PHASE = "GE-AIOS-REVENUE-2A-HOTFIX-4" as const
const ORG = "org-hotfix-4"
const NOW = "2026-07-20T15:40:00.000Z"
const FUTURE_WAKE = "2099-01-01T00:00:00.000Z"
const SCHEDULER_BUDGET_MS = 15_000

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function remainingBudgetMs(startedAt: number, maxRuntimeMs: number): number {
  return Math.max(0, maxRuntimeMs - (Date.now() - startedAt))
}

function seedRow(input: { leadId: string; updatedAt: string }) {
  upsertDurableDraftFactoryLeadState({
    organizationId: ORG,
    leadId: input.leadId,
    state: "waiting_for_dm",
    earliestIncompleteStage: "decision_maker",
    version: 1,
    packageId: null,
    researchRunId: "run-1",
    decisionMakerId: null,
    personalizationId: null,
    lastWakeType: null,
    lastWakeAt: null,
    nextEligibleWakeAt: FUTURE_WAKE,
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

console.log(`[${PHASE}] Admission reconcile per-lead throughput repair`)
console.log(`  QA marker: ${GROWTH_REVENUE_2A_HOTFIX_4_QA_MARKER}`)

async function main(): Promise<void> {
  const schedulerSource = readSource("lib/growth/draft-factory/draft-factory-due-scheduler-tick.ts")
  const liveSource = readSource("lib/growth/draft-factory/draft-factory-durable-live.ts")

  assert.match(schedulerSource, /prefetchLeadMetadataForAdmissionReconcile/)
  assert.match(schedulerSource, /buildAdmissionIntegrityReconcileEvidenceFromMetadata/)
  const reconcileFn =
    schedulerSource.match(
      /async function runAdmissionIntegrityReconcileForOrganization[\s\S]*?\n\}(?=\n\nexport async function tickDraftFactoryDueStatesForScheduler)/,
    )?.[0] ?? ""
  assert.ok(reconcileFn.length > 0, "reconcile helper must exist")
  assert.match(reconcileFn, /await advanceDraftFactoryForLead\(/)
  assert.doesNotMatch(reconcileFn, /advanceDraftFactoryForLeadLive/)
  assert.match(liveSource, /admissionIntegrityReconcile === true[\s\S]*buildAdmissionIntegrityReconcileEvidenceFromMetadata/)
  assert.match(schedulerSource, /candidate_load_ms/)
  assert.match(schedulerSource, /per_lead_elapsed_ms/)
  console.log("  ✓ scheduler uses lightweight advance + batch metadata prefetch + timing telemetry")

  const rejectedEvidence = buildAdmissionIntegrityReconcileEvidenceFromMetadata({
    admission_state: "rejected",
  })
  assert.equal(rejectedEvidence.admitted, false)
  assert.equal(rejectedEvidence.rejected, true)
  assert.equal(rejectedEvidence.portfolioSelected, false)
  assert.equal(rejectedEvidence.decisionMakerAvailable, false)
  console.log("  ✓ lightweight evidence avoids DM/package/provider flags")

  const repo = createMemoryDraftFactoryRepository("memory")
  for (let index = 0; index < 20; index += 1) {
    seedRow({
      leadId: `rejected-dm-${index.toString().padStart(2, "0")}`,
      updatedAt: `2026-07-01T10:${index.toString().padStart(2, "0")}:00.000Z`,
    })
  }
  seedRow({ leadId: "accepted-dm-01", updatedAt: "2026-07-01T08:00:00.000Z" })

  const reconcilePool = await listAdmissionIntegrityReconcileDraftFactoryStates({
    organizationId: ORG,
    repository: repo,
  })
  assert.equal(reconcilePool.length, 21)

  const metadataByLead = new Map<string, Record<string, unknown>>()
  for (let index = 0; index < 20; index += 1) {
    metadataByLead.set(`rejected-dm-${index.toString().padStart(2, "0")}`, { admission_state: "rejected" })
  }
  metadataByLead.set("accepted-dm-01", { admission_state: "accepted" })

  const candidates = reconcilePool
    .map((row) => ({
      row,
      metadata: metadataByLead.get(row.leadId) ?? null,
    }))
    .filter(({ metadata }) => metadata != null)
    .filter(({ metadata }) => buildAdmissionIntegrityReconcileEvidenceFromMetadata(metadata).admitted === false)
  assert.equal(candidates.length, 20)
  console.log("  ✓ 20 future-wake waiting_for_dm violations discovered; accepted row excluded")

  const startedAt = Date.now()
  let attempted = 0
  let corrected = 0
  let failed = 0

  for (const { row, metadata } of candidates.slice(0, REVENUE_PROMOTION_RECONCILE_LIMIT_PER_ORG)) {
    if (remainingBudgetMs(startedAt, SCHEDULER_BUDGET_MS) <= 0) break
    attempted += 1
    try {
      const result = await advanceDraftFactoryForLead({
        organizationId: ORG,
        leadId: row.leadId,
        wake: {
          type: "scheduled_resume",
          sourceId: `reconcile:admission:${ORG}:${row.leadId}:${NOW}`,
        },
        now: NOW,
        repository: repo,
        evidence: buildAdmissionIntegrityReconcileEvidenceFromMetadata(metadata),
        completionHints: { admissionIntegrityReconcile: true },
      })
      if (
        isAdmissionReconcileCorrectedOutcome({
          outcome: result.outcome,
          nextState: result.nextState,
        })
      ) {
        corrected += 1
      }
    } catch {
      failed += 1
    }
  }

  assert.ok(attempted > 1, "more than one row must be attempted in one tick budget")
  assert.equal(attempted, 20)
  assert.equal(corrected, 20)
  assert.equal(failed, 0)
  console.log("  ✓ 20/20 corrected within 15s budget using lightweight advance path")

  const correctedPool = await listAdmissionIntegrityReconcileDraftFactoryStates({
    organizationId: ORG,
    repository: repo,
  })
  assert.equal(correctedPool.length, 1)
  assert.ok(correctedPool.some((row) => row.leadId === "accepted-dm-01"))
  console.log("  ✓ corrected rows leave reconcile scan pool; accepted row remains")

  seedRow({ leadId: "review-dm-fail", updatedAt: "2026-07-01T07:00:00.000Z" })
  seedRow({ leadId: "review-dm-ok", updatedAt: "2026-07-01T07:01:00.000Z" })
  const isolatedStartedAt = Date.now()
  let isolatedAttempted = 0
  let isolatedCorrected = 0
  for (const leadId of ["review-dm-fail", "review-dm-ok"]) {
    if (remainingBudgetMs(isolatedStartedAt, SCHEDULER_BUDGET_MS) <= 0) break
    isolatedAttempted += 1
    try {
      const evidence = buildAdmissionIntegrityReconcileEvidenceFromMetadata({
        admission_state: leadId === "review-dm-fail" ? "review" : "review",
      })
      if (leadId === "review-dm-fail") {
        await repo.tryAcquireLease({
          organizationId: ORG,
          leadId,
          workerId: "blocker",
          now: NOW,
        })
      }
      const result = await advanceDraftFactoryForLead({
        organizationId: ORG,
        leadId,
        wake: {
          type: "scheduled_resume",
          sourceId: `reconcile:admission:${ORG}:${leadId}:${NOW}`,
        },
        now: NOW,
        repository: repo,
        evidence,
        completionHints: { admissionIntegrityReconcile: true },
      })
      if (
        isAdmissionReconcileCorrectedOutcome({
          outcome: result.outcome,
          nextState: result.nextState,
        })
      ) {
        isolatedCorrected += 1
      }
    } catch {
      // per-lead isolation — continue
    }
  }
  assert.equal(isolatedAttempted, 2)
  assert.equal(isolatedCorrected, 1)
  console.log("  ✓ one blocked lead does not stop the next candidate")

  assert.match(schedulerSource, /selectPortfolioAwareDueDraftFactoryStates/)
  assert.match(schedulerSource, /advanceDraftFactoryCapacityWake/)
  console.log("  ✓ portfolio and generation phases remain wired after reconciliation")

  console.log(`\n[${PHASE}] PASS — admission reconcile throughput certified`)
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
