/**
 * AVA-DRAFT-FACTORY-GENERATION-RECOVERY-1A — Certification.
 * Run: pnpm test:ava-draft-factory-generation-recovery-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  collectGenerationCapacityCandidates,
  GROWTH_AIOS_AUTONOMY_1F_QA_MARKER,
  isWaitingForGenerationDurableState,
} from "@/lib/growth/draft-factory/draft-factory-generation-capacity"
import { advanceDraftFactoryCapacityWake } from "@/lib/growth/draft-factory/draft-factory-durable-service"
import { createMemoryDraftFactoryRepository } from "@/lib/growth/draft-factory/draft-factory-durable-memory-repository"
import {
  clearDurableDraftFactoryStoreForTests,
  listDueDurableDraftFactoryStates,
  listWaitingForGenerationDurableDraftFactoryStates,
  upsertDurableDraftFactoryLeadState,
} from "@/lib/growth/draft-factory/draft-factory-durable-store"
import { emptyAttemptCounts } from "@/lib/growth/draft-factory/draft-factory-durable-types"
import {
  GROWTH_AIOS_DRAFT_FACTORY_GENERATION_RECOVERY_1A_QA_MARKER,
  GROWTH_DRAFT_FACTORY_CAPACITY_SLOTS_PER_ORG,
  GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG,
} from "@/lib/growth/draft-factory/draft-factory-wake-event-types"
import type { AiOsDraftFactoryCanonicalEvidence } from "@/lib/growth/draft-factory/draft-factory-durable-types"

const ROOT = process.cwd()
const ORG = "5876176a-61ec-4532-ad99-0c31482d5a91"
const BLOCK_IMAGING = "6d9220f0-2960-468c-b4be-5d7595d292c3"
const GEN_READY_A = "e7466319-9112-40a3-af46-d33c63f35823"
const GEN_READY_B = "4f443634-54bf-4eb9-a114-93a287712a83"
const GEN_READY_C = "fd0274c4-5aa5-4524-ac1a-db6a64bb41f5"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function baseEvidence(
  overrides: Partial<AiOsDraftFactoryCanonicalEvidence> = {},
): AiOsDraftFactoryCanonicalEvidence {
  return {
    admitted: true,
    researchCurrent: true,
    knowledgeComplete: true,
    stopInvestment: false,
    portfolioSelected: true,
    decisionMakerAvailable: true,
    contactVerifiedForEmail: true,
    personalizationReady: true,
    researchSufficientForPackage: true,
    draftValid: false,
    approved: false,
    rejected: false,
    investmentState: "increase_investment",
    spendAuthorized: true,
    ...overrides,
  }
}

function seedState(input: {
  leadId: string
  state: string
  updatedAt: string
  pausedReason?: string | null
  lastErrorCode?: string | null
}) {
  upsertDurableDraftFactoryLeadState({
    organizationId: ORG,
    leadId: input.leadId,
    state: input.state as "waiting_for_generation",
    earliestIncompleteStage: "generation",
    version: 1,
    packageId: null,
    researchRunId: null,
    decisionMakerId: null,
    personalizationId: null,
    lastWakeType: null,
    lastWakeAt: null,
    nextEligibleWakeAt: null,
    attemptCounts: emptyAttemptCounts(),
    lastErrorCode: input.lastErrorCode ?? null,
    lastErrorStage: null,
    pausedReason: input.pausedReason ?? null,
    leaseOwner: null,
    leaseExpiresAt: null,
    createdAt: input.updatedAt,
    updatedAt: input.updatedAt,
  })
}

async function main() {
  console.log(`[${GROWTH_AIOS_DRAFT_FACTORY_GENERATION_RECOVERY_1A_QA_MARKER}] certification\n`)

  const tickSrc = readSource("lib/growth/draft-factory/draft-factory-due-scheduler-tick.ts")
  const repoCoreSrc = readSource("lib/growth/draft-factory/draft-factory-durable-repository-core.ts")
  const capacitySrc = readSource("lib/growth/draft-factory/draft-factory-generation-capacity.ts")

  assert.match(tickSrc, /listWaitingForGenerationDraftFactoryStates/)
  assert.match(tickSrc, /generationReadyStates:/)
  assert.match(tickSrc, /draft_factory_generation_capacity_selection/)
  assert.match(tickSrc, /assessGrowthResearchSufficiencyFromLead/)
  assert.match(repoCoreSrc, /listWaitingForGenerationStates/)
  assert.match(repoCoreSrc, /neq\("paused_reason", "stop_investment"\)/)
  assert.match(capacitySrc, /generationReadyStates/)
  assert.equal(GROWTH_DRAFT_FACTORY_CAPACITY_SLOTS_PER_ORG, 5)
  assert.equal(GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG, 10)
  console.log("  ✓ dedicated generation pool + stop_investment due hygiene wired")

  clearDurableDraftFactoryStoreForTests()
  const now = "2026-07-24T12:00:00.000Z"

  // Starvation fixture: 100 older waiting_for_research rows fill due pool; generation-ready absent from due.
  for (let i = 0; i < 100; i += 1) {
    seedState({
      leadId: `research-backlog-${i}`,
      state: "waiting_for_research",
      updatedAt: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
    })
  }
  seedState({
    leadId: `paused-stop-0`,
    state: "paused",
    updatedAt: `2026-02-01T00:00:00.000Z`,
    pausedReason: "stop_investment",
  })
  seedState({
    leadId: GEN_READY_A,
    state: "waiting_for_generation",
    updatedAt: "2026-07-20T12:00:00.000Z",
    lastErrorCode: "orphan_approval_package_reconciled",
  })
  seedState({
    leadId: GEN_READY_B,
    state: "waiting_for_generation",
    updatedAt: "2026-07-21T12:00:00.000Z",
  })
  seedState({
    leadId: GEN_READY_C,
    state: "waiting_for_generation",
    updatedAt: "2026-07-22T12:00:00.000Z",
  })

  const duePool = listDueDurableDraftFactoryStates({ organizationId: ORG, now, limit: 100 })
  assert.equal(duePool.some((row) => row.leadId === GEN_READY_A), false, "due FIFO must not include starved generation-ready")
  assert.equal(duePool.some((row) => row.leadId === "paused-stop-0"), false)
  console.log("  ✓ stop_investment rows excluded from due pool")

  const dedicatedPool = listWaitingForGenerationDurableDraftFactoryStates({
    organizationId: ORG,
    now,
    limit: 20,
  })
  assert.equal(dedicatedPool.length, 3)
  assert.ok(isWaitingForGenerationDurableState(dedicatedPool[0]?.state))
  console.log("  ✓ dedicated pool discovers waiting_for_generation independent of due FIFO")

  const pool = collectGenerationCapacityCandidates({
    deferredStates: [],
    dueStates: duePool.map((row) => ({
      leadId: row.leadId,
      state: row.state,
      updatedAt: row.updatedAt,
    })),
    generationReadyStates: dedicatedPool.map((row) => ({
      leadId: row.leadId,
      state: row.state,
      updatedAt: row.updatedAt,
    })),
    limit: 10,
  })
  assert.equal(pool.waitingForGenerationCount, 3)
  assert.deepEqual(
    pool.candidates.map((row) => row.leadId),
    [GEN_READY_A, GEN_READY_B, GEN_READY_C],
  )
  console.log("  ✓ generation-ready outranks paused; recovered orphan same as natural")

  const repo = createMemoryDraftFactoryRepository("memory")
  let generateCalls = 0
  const capacity = await advanceDraftFactoryCapacityWake({
    organizationId: ORG,
    capacityClass: "llm_drafting",
    capacitySlotsAvailable: 2,
    now,
    repository: repo,
    candidates: [
      {
        leadId: GEN_READY_A,
        investmentState: "increase_investment",
        spendAuthorized: true,
        evidence: baseEvidence(),
        signals: { missionPriorityOverall: 99 },
      },
      {
        leadId: "paused-stop-1",
        investmentState: "stop_investment",
        spendAuthorized: false,
        evidence: baseEvidence({ stopInvestment: true }),
        signals: { missionPriorityOverall: 100 },
      },
      {
        leadId: GEN_READY_B,
        investmentState: "increase_investment",
        spendAuthorized: true,
        evidence: baseEvidence(),
        signals: { missionPriorityOverall: 98 },
      },
    ],
    generateViaGrowth5F: async ({ leadId, now: generatedAt }) => {
      generateCalls += 1
      return {
        packageId: `growth5f:${leadId}:${generatedAt}`,
        pendingHumanApproval: true as const,
        transportBlocked: true as const,
      }
    },
  })
  assert.deepEqual(capacity.selectedLeadIds, [GEN_READY_A, GEN_READY_B])
  assert.equal(generateCalls, 2)
  assert.ok(capacity.deferredLeadIds.includes("paused-stop-1"))
  console.log("  ✓ capacity > 0 selects generation-ready; stop_investment deferred")

  // Duplicate valid package must not regenerate
  const dup = await advanceDraftFactoryCapacityWake({
    organizationId: ORG,
    capacityClass: "llm_drafting",
    capacitySlotsAvailable: 1,
    now: "2026-07-24T12:01:00.000Z",
    repository: repo,
    candidates: [
      {
        leadId: GEN_READY_A,
        investmentState: "increase_investment",
        spendAuthorized: true,
        evidence: baseEvidence({
          draftValid: true,
          packageId: capacity.results.find((row) => row.leadId === GEN_READY_A)?.packageId ?? null,
        }),
        signals: { missionPriorityOverall: 99 },
      },
    ],
    generateViaGrowth5F: async () => {
      generateCalls += 1
      throw new Error("must not regenerate valid package")
    },
  })
  const dupResult = dup.results.find((row) => row.leadId === GEN_READY_A)
  assert.ok(dupResult?.outcome === "duplicate_noop" || dupResult?.packageId)
  assert.equal(generateCalls, 2)
  console.log("  ✓ duplicate valid generation suppresses another generation")

  // Block Imaging wiring unchanged
  assert.ok(tickSrc.includes(BLOCK_IMAGING) || readSource("scripts/test-ge-aios-autonomy-1f-draft-generation-capacity-path.ts").includes(BLOCK_IMAGING))
  assert.equal(/modifySenderPool|senderAffinity|assignSender/i.test(tickSrc), false)
  assert.equal(/avaSupervisedOutboundApproval|autoApprove|sendEligible:\s*true/i.test(tickSrc), false)
  console.log("  ✓ no sender pool / approval / send changes in scheduler tick")

  assert.match(tickSrc, /createDraftFactorySupervisedAvaGenerationHandoff/)
  assert.match(tickSrc, /pending_human_approval: true/)
  assert.match(tickSrc, /transport_blocked: true/)
  console.log("  ✓ selected generation invokes supervised Ava scheduler handoff")

  assert.equal(GROWTH_AIOS_AUTONOMY_1F_QA_MARKER, "ge-aios-autonomy-1f-draft-generation-capacity-path-v1")
  console.log(`\nPASS — ${GROWTH_AIOS_DRAFT_FACTORY_GENERATION_RECOVERY_1A_QA_MARKER}`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
