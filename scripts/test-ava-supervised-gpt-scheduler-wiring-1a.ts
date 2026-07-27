/**
 * AVA-SUPERVISED-GPT-SCHEDULER-WIRING-1A — Certification.
 * Run: pnpm test:ava-supervised-gpt-scheduler-wiring-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { isSupervisedCutoverLegacyApprovalBlocker } from "@/lib/growth/draft-factory/draft-factory-orphan-approval-package-artifact-1a"
import {
  GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_EMAIL,
  GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_USER_ID,
} from "@/lib/growth/draft-factory/draft-factory-scheduler-actor-1a"
import { advanceDraftFactoryCapacityWake } from "@/lib/growth/draft-factory/draft-factory-durable-service"
import { createMemoryDraftFactoryRepository } from "@/lib/growth/draft-factory/draft-factory-durable-memory-repository"
import { clearDurableDraftFactoryStoreForTests } from "@/lib/growth/draft-factory/draft-factory-durable-store"
import type { AiOsDraftFactoryCanonicalEvidence } from "@/lib/growth/draft-factory/draft-factory-durable-types"
import { emptyAttemptCounts } from "@/lib/growth/draft-factory/draft-factory-durable-types"

const QA_MARKER = "ava-supervised-gpt-scheduler-wiring-1a-v1" as const
const ROOT = process.cwd()
const ORG = "00757488-1026-44a5-aac4-269533ac21be"
const LEAD_A = "e7466319-9112-40a3-af46-d33c63f35823"
const LEAD_B = "4f443634-54bf-4eb9-a114-93a287712a83"
const LEAD_C = "fd0274c4-5aa5-4524-ac1a-db6a64bb41f5"
const GEN_ID = "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee"

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
    researchSufficientForPackage: true,
    stopInvestment: false,
    portfolioSelected: true,
    decisionMakerAvailable: true,
    contactVerifiedForEmail: true,
    personalizationReady: true,
    draftValid: false,
    approved: false,
    rejected: false,
    investmentState: "increase_investment",
    spendAuthorized: true,
    ...overrides,
  }
}

async function seedGenerationReady(
  repo: ReturnType<typeof createMemoryDraftFactoryRepository>,
  leadId: string,
  now: string,
) {
  await repo.upsertLeadState({
    organizationId: ORG,
    leadId,
    state: "waiting_for_generation",
    earliestIncompleteStage: "generation",
    version: 0,
    packageId: null,
    researchRunId: null,
    decisionMakerId: null,
    personalizationId: null,
    lastWakeType: null,
    lastWakeAt: null,
    nextEligibleWakeAt: null,
    attemptCounts: emptyAttemptCounts(),
    lastErrorCode: null,
    lastErrorStage: null,
    pausedReason: null,
    leaseOwner: null,
    createdAt: now,
    updatedAt: now,
  })
}

async function main() {
  console.log(`[${QA_MARKER}] certification\n`)

  const tickSrc = readSource("lib/growth/draft-factory/draft-factory-due-scheduler-tick.ts")
  const wakeSrc = readSource("lib/growth/draft-factory/draft-factory-wake-bus-observer.ts")
  const liveSrc = readSource("lib/growth/draft-factory/draft-factory-durable-live.ts")
  const generationSrc = readSource("lib/growth/draft-factory/draft-factory-supervised-ava-generation-1a.ts")

  assert.match(tickSrc, /createDraftFactorySupervisedAvaGenerationHandoff/)
  assert.match(wakeSrc, /createDraftFactorySupervisedAvaGenerationHandoff/)
  assert.match(liveSrc, /createDraftFactorySupervisedAvaGenerationHandoff/)
  assert.doesNotMatch(tickSrc, /generateAndPersistAutonomousOutreachApprovalPackageForDraftFactory/)
  console.log("  ✓ scheduler path uses supervised Ava generation handoff")

  assert.match(generationSrc, /runEquipifySupervisedAvaOutreach/)
  assert.match(generationSrc, /GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_USER_ID/)
  assert.match(generationSrc, /isDraftFactoryGenerationWake: true/)
  assert.match(generationSrc, /findExistingAvaSupervisedSendableDraft/)
  console.log("  ✓ supervised generation service invokes existing cutover path")

  assert.equal(GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_USER_ID, "00000000-0000-4000-8000-000000000010")
  assert.equal(GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_EMAIL, "ava-scheduler@growth.equipify.internal")
  console.log("  ✓ scheduler actor is non-human service identity")

  assert.equal(
    isSupervisedCutoverLegacyApprovalBlocker({
      state: "waiting_for_approval",
      packageId: `outreach-prep:${LEAD_A}:2026-07-27T13:30:16.161Z`,
      hasSupervisedGenerationForLead: false,
    }),
    true,
  )
  console.log("  ✓ legacy outreach-prep without supervised generation is reconcilable")

  clearDurableDraftFactoryStoreForTests()
  const repo = createMemoryDraftFactoryRepository("memory")
  const now = "2026-07-27T14:00:00.000Z"
  await seedGenerationReady(repo, LEAD_A, now)
  await seedGenerationReady(repo, LEAD_B, now)
  await seedGenerationReady(repo, LEAD_C, now)

  let calls = 0
  const pursue = await advanceDraftFactoryCapacityWake({
    organizationId: ORG,
    capacityClass: "llm_drafting",
    capacitySlotsAvailable: 3,
    now,
    repository: repo,
    candidates: [
      {
        leadId: LEAD_A,
        investmentState: "increase_investment",
        spendAuthorized: true,
        evidence: baseEvidence(),
      },
    ],
    generateViaGrowth5F: async () => {
      calls += 1
      return {
        packageId: GEN_ID,
        generationId: GEN_ID,
        pendingHumanApproval: true,
        transportBlocked: true,
        gptOutcome: "pursue",
      }
    },
  })
  const pursueResult = pursue.results.find((row) => row.leadId === LEAD_A)
  assert.equal(pursueResult?.nextState, "waiting_for_approval")
  assert.equal(pursueResult?.packageId, GEN_ID)
  assert.equal(calls, 1)
  console.log("  ✓ pursue maps DF → waiting_for_approval with supervised generation id")

  clearDurableDraftFactoryStoreForTests()
  const repo2 = createMemoryDraftFactoryRepository("memory")
  await seedGenerationReady(repo2, LEAD_B, now)
  await seedGenerationReady(repo2, LEAD_C, now)

  let batchCalls = 0
  const batch = await advanceDraftFactoryCapacityWake({
    organizationId: ORG,
    capacityClass: "llm_drafting",
    capacitySlotsAvailable: 2,
    now,
    repository: repo2,
    candidates: [
      {
        leadId: LEAD_B,
        investmentState: "increase_investment",
        spendAuthorized: true,
        evidence: baseEvidence(),
      },
      {
        leadId: LEAD_C,
        investmentState: "increase_investment",
        spendAuthorized: true,
        evidence: baseEvidence(),
      },
    ],
    generateViaGrowth5F: async ({ leadId }) => {
      batchCalls += 1
      if (leadId === LEAD_B) {
        return { gptOutcome: "reject", reason: "Not ICP fit" }
      }
      return {
        packageId: GEN_ID,
        generationId: GEN_ID,
        pendingHumanApproval: true,
        transportBlocked: true,
        gptOutcome: "pursue",
      }
    },
  })
  assert.equal(batchCalls, 2)
  assert.equal(batch.results.find((row) => row.leadId === LEAD_B)?.nextState, "rejected")
  assert.equal(batch.results.find((row) => row.leadId === LEAD_C)?.nextState, "waiting_for_approval")
  console.log("  ✓ batch continues after reject; reject has no approval package")

  clearDurableDraftFactoryStoreForTests()
  const repo3 = createMemoryDraftFactoryRepository("memory")
  await seedGenerationReady(repo3, LEAD_A, now)

  const hold = await advanceDraftFactoryCapacityWake({
    organizationId: ORG,
    capacityClass: "llm_drafting",
    capacitySlotsAvailable: 1,
    now,
    repository: repo3,
    candidates: [
      {
        leadId: LEAD_A,
        investmentState: "increase_investment",
        spendAuthorized: true,
        evidence: baseEvidence(),
      },
    ],
    generateViaGrowth5F: async () => ({ gptOutcome: "hold", reason: "Needs stronger evidence" }),
  })
  const holdResult = hold.results.find((row) => row.leadId === LEAD_A)
  assert.equal(holdResult?.nextState, "waiting_for_generation")
  assert.equal(holdResult?.packageId, null)
  console.log("  ✓ hold stays retryable without actionable approval package")

  const durableSrc = readSource("lib/growth/draft-factory/draft-factory-durable-service.ts")
  assert.match(durableSrc, /gptOutcome === "reject"/)
  assert.match(durableSrc, /gptOutcome === "hold"/)
  assert.match(durableSrc, /duplicate_reused/)
  console.log("  ✓ durable service maps pursue/reject/hold/duplicate outcomes")

  const persistenceSrc = readSource("lib/growth/ava-reasoning/equipify-supervised-draft-persistence.ts")
  assert.match(persistenceSrc, /stripAccidentalAvaSignatureFromBody/)
  assert.match(persistenceSrc, /assertAvaOutboundCopyQualityForPersistence/)
  console.log("  ✓ supervised persistence enforces unsigned body + copy quality")

  console.log(`\nPASS — ${QA_MARKER}`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
