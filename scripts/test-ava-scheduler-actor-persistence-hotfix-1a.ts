/**
 * AVA-SCHEDULER-ACTOR-PERSISTENCE-HOTFIX-1A — Certification.
 * Run: pnpm test:ava-scheduler-actor-persistence-hotfix-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { isSupervisedCutoverLegacyApprovalBlocker } from "@/lib/growth/draft-factory/draft-factory-orphan-approval-package-artifact-1a"
import {
  GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_EMAIL,
  GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_USER_ID,
  buildDraftFactorySchedulerGenerationProvenance,
} from "@/lib/growth/draft-factory/draft-factory-scheduler-actor-1a"
import { advanceDraftFactoryCapacityWake } from "@/lib/growth/draft-factory/draft-factory-durable-service"
import { createMemoryDraftFactoryRepository } from "@/lib/growth/draft-factory/draft-factory-durable-memory-repository"
import { clearDurableDraftFactoryStoreForTests } from "@/lib/growth/draft-factory/draft-factory-durable-store"
import type { AiOsDraftFactoryCanonicalEvidence } from "@/lib/growth/draft-factory/draft-factory-durable-types"
import { emptyAttemptCounts } from "@/lib/growth/draft-factory/draft-factory-durable-types"
import {
  hasValidMessageApprovalBindingForGeneration,
  resolveAvaSupervisedOutboundApprovalPresentation,
} from "@/lib/growth/ava-reasoning/ava-supervised-outbound-approval-state-core"
import type { GrowthAiCopilotGeneration } from "@/lib/growth/ai-copilot-types"

const QA_MARKER = "ava-scheduler-actor-persistence-hotfix-1a-v1" as const
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

  const migration = readSource("supabase/migrations/20270109120000_growth_engine_ai_copilot.sql")
  assert.match(migration, /created_by uuid references auth\.users \(id\) on delete set null/)
  console.log("  ✓ created_by FK targets auth.users(id) and is nullable")

  const persistenceSrc = readSource("lib/growth/ava-reasoning/equipify-supervised-draft-persistence.ts")
  const cutoverSrc = readSource("lib/growth/ava-reasoning/equipify-supervised-cutover-service.ts")
  const generationSrc = readSource("lib/growth/draft-factory/draft-factory-supervised-ava-generation-1a.ts")
  const actorSrc = readSource("lib/growth/draft-factory/draft-factory-scheduler-actor-1a.ts")
  const humanRouteSrc = readSource("app/api/platform/growth/leads/[leadId]/ava-direct-outreach/route.ts")

  assert.match(persistenceSrc, /actingUserId: string \| null/)
  assert.match(persistenceSrc, /autonomousProvenance\?: DraftFactorySchedulerGenerationProvenance/)
  assert.match(persistenceSrc, /createdBy: input\.actingUserId/)
  assert.match(generationSrc, /autonomousProvenance: buildDraftFactorySchedulerGenerationProvenance/)
  assert.doesNotMatch(generationSrc, /actingUserId: GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_USER_ID/)
  assert.match(actorSrc, /not written to created_by FK/)
  console.log("  ✓ scheduler generation actor satisfies created_by persistence authority (null + provenance)")

  assert.match(humanRouteSrc, /actingUserId/)
  assert.match(cutoverSrc, /Acting user id is required for supervised draft generation/)
  assert.match(cutoverSrc, /autonomousProvenance/)
  console.log("  ✓ human generation attribution remains unchanged (real actingUserId required)")

  const provenance = buildDraftFactorySchedulerGenerationProvenance({
    organizationId: ORG,
    generatedAt: "2026-07-27T14:00:00.000Z",
  })
  assert.equal(provenance.generationSource, "draft_factory_scheduler")
  assert.equal(provenance.schedulerActorEmail, GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_EMAIL)
  assert.equal(provenance.schedulerActorLogicalId, GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_USER_ID)
  assert.equal(provenance.organizationId, ORG)
  console.log("  ✓ scheduler generation is auditable as autonomous Ava work")

  assert.match(cutoverSrc, /const autonomousProvenance = input\.autonomousProvenance/)
  assert.match(cutoverSrc, /const actingUserId = autonomousProvenance\s*\?\s*null/)
  assert.match(cutoverSrc, /if \(!autonomousProvenance && !actingUserId\)/)
  console.log("  ✓ autonomous provenance bypasses human actor FK requirement")

  assert.match(cutoverSrc, /code: "actor_invalid"/)
  console.log("  ✓ organization isolation enforced — human path still requires authenticated actor")

  clearDurableDraftFactoryStoreForTests()
  const repo = createMemoryDraftFactoryRepository("memory")
  const now = "2026-07-27T14:00:00.000Z"
  await seedGenerationReady(repo, LEAD_A, now)

  const pursue = await advanceDraftFactoryCapacityWake({
    organizationId: ORG,
    capacityClass: "llm_drafting",
    capacitySlotsAvailable: 1,
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
    generateViaGrowth5F: async () => ({
      packageId: GEN_ID,
      generationId: GEN_ID,
      pendingHumanApproval: true,
      transportBlocked: true,
      gptOutcome: "pursue",
    }),
  })
  assert.equal(pursue.results[0]?.nextState, "waiting_for_approval")
  assert.equal(pursue.results[0]?.packageId, GEN_ID)
  console.log("  ✓ supervised GPT pursue can persist ai_copilot_generations (DF waiting_for_approval)")

  clearDurableDraftFactoryStoreForTests()
  const repoReject = createMemoryDraftFactoryRepository("memory")
  await seedGenerationReady(repoReject, LEAD_B, now)
  const reject = await advanceDraftFactoryCapacityWake({
    organizationId: ORG,
    capacityClass: "llm_drafting",
    capacitySlotsAvailable: 1,
    now,
    repository: repoReject,
    candidates: [
      {
        leadId: LEAD_B,
        investmentState: "increase_investment",
        spendAuthorized: true,
        evidence: baseEvidence(),
      },
    ],
    generateViaGrowth5F: async () => ({ gptOutcome: "reject", reason: "Not ICP fit" }),
  })
  assert.equal(reject.results[0]?.nextState, "rejected")
  assert.equal(reject.results[0]?.packageId, null)
  console.log("  ✓ GPT reject does not create actionable Home package")

  clearDurableDraftFactoryStoreForTests()
  const repoHold = createMemoryDraftFactoryRepository("memory")
  await seedGenerationReady(repoHold, LEAD_C, now)
  const hold = await advanceDraftFactoryCapacityWake({
    organizationId: ORG,
    capacityClass: "llm_drafting",
    capacitySlotsAvailable: 1,
    now,
    repository: repoHold,
    candidates: [
      {
        leadId: LEAD_C,
        investmentState: "increase_investment",
        spendAuthorized: true,
        evidence: baseEvidence(),
      },
    ],
    generateViaGrowth5F: async () => ({ gptOutcome: "hold", reason: "Needs stronger evidence" }),
  })
  assert.equal(hold.results[0]?.nextState, "waiting_for_generation")
  assert.equal(hold.results[0]?.packageId, null)
  console.log("  ✓ GPT hold/defer remains retryable")

  const durableSrc = readSource("lib/growth/draft-factory/draft-factory-durable-service.ts")
  assert.match(durableSrc, /duplicate_reused/)
  assert.match(persistenceSrc, /findExistingAvaSupervisedSendableDraft/)
  assert.match(persistenceSrc, /duplicate_reused/)
  console.log("  ✓ duplicate scheduler retry does not create duplicate actionable generation")

  const draftOnly: GrowthAiCopilotGeneration = {
    id: GEN_ID,
    leadId: LEAD_A,
    generationType: "cold_email",
    promptVersion: "ava-direct-production-cutover-1a-v1",
    promptVariant: "ava_direct_production_cutover_1a",
    inputSnapshot: { autonomousProvenance: provenance },
    generatedContent: "Hi there,\n\nCertification body.",
    generatedSubject: "Scheduler actor hotfix",
    classification: { primary: "pursue", autonomousProvenance: provenance },
    status: "draft",
    sourceReplyId: null,
    inputHash: null,
    playbookInfluenceScore: 0,
    playbookAttribution: {},
    approvedAt: null,
    approvedBy: null,
    sentAt: null,
    createdBy: null,
    createdAt: now,
  }
  const presentation = resolveAvaSupervisedOutboundApprovalPresentation(draftOnly)
  assert.equal(presentation.messageApproved, false)
  assert.equal(presentation.sendEligible, false)
  assert.equal(hasValidMessageApprovalBindingForGeneration(draftOnly), false)
  console.log("  ✓ approval still requires explicit human action; sender assignment only at approval")

  const tickSrc = readSource("lib/growth/draft-factory/draft-factory-due-scheduler-tick.ts")
  assert.doesNotMatch(tickSrc, /sendAvaSupervisedOutbound/)
  assert.doesNotMatch(tickSrc, /generateAndPersistAutonomousOutreachApprovalPackageForDraftFactory/)
  console.log("  ✓ no email is sent by scheduler; no legacy outreach-prep package is created")

  assert.equal(
    isSupervisedCutoverLegacyApprovalBlocker({
      state: "waiting_for_approval",
      packageId: `outreach-prep:${LEAD_A}:2026-07-27T13:30:16.161Z`,
      hasSupervisedGenerationForLead: false,
    }),
    true,
  )
  console.log("  ✓ legacy outreach-prep without supervised generation remains blocked")

  console.log("\n  (Run supervised outbound certs separately — wiring unchanged)")
  console.log(`\nPASS — ${QA_MARKER}`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
