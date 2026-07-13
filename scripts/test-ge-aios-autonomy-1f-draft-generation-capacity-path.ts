/**
 * GE-AIOS-AUTONOMY-1F — Draft generation capacity path certification.
 * Run: pnpm test:ge-aios-autonomy-1f-draft-generation-capacity-path
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_AUTONOMY_1F_QA_MARKER,
  collectGenerationCapacityCandidates,
  isWaitingForGenerationDurableState,
} from "../lib/growth/draft-factory/draft-factory-generation-capacity"
import { mapDurableStateToPortfolioCapacityClass } from "../lib/growth/draft-factory/draft-factory-due-capacity-class"
import { advanceDraftFactoryCapacityWake } from "../lib/growth/draft-factory/draft-factory-durable-service"
import { createMemoryDraftFactoryRepository } from "../lib/growth/draft-factory/draft-factory-durable-memory-repository"
import { clearDurableDraftFactoryStoreForTests } from "../lib/growth/draft-factory/draft-factory-durable-store"
import type { AiOsDraftFactoryCanonicalEvidence } from "../lib/growth/draft-factory/draft-factory-durable-types"

const ROOT = process.cwd()
const ORG = "5876176a-61ec-4532-ad99-0c31482d5a91"
const BLOCK_IMAGING = "6d9220f0-2960-468c-b4be-5d7595d292c3"

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
    decisionMakerId: "28b54a56-900c-4571-9fe6-fa9c1aaf371f",
    contactVerifiedForEmail: true,
    personalizationReady: true,
    draftValid: false,
    approved: false,
    rejected: false,
    ...overrides,
  }
}

console.log(`[${GROWTH_AIOS_AUTONOMY_1F_QA_MARKER}] Draft generation capacity path certification`)

assert.equal(GROWTH_AIOS_AUTONOMY_1F_QA_MARKER, "ge-aios-autonomy-1f-draft-generation-capacity-path-v1")
assert.equal(mapDurableStateToPortfolioCapacityClass("waiting_for_generation"), "llm_drafting")
assert.equal(isWaitingForGenerationDurableState("waiting_for_generation"), true)
assert.equal(isWaitingForGenerationDurableState("waiting_for_dm"), false)
console.log("  ✓ waiting_for_generation maps to llm_drafting")

// Capacity pool discovers waiting_for_generation even when deferred is empty
const pool = collectGenerationCapacityCandidates({
  deferredStates: [],
  dueStates: [
    {
      leadId: "research-1",
      state: "waiting_for_research",
      updatedAt: "2026-06-01T12:00:00.000Z",
    },
    {
      leadId: BLOCK_IMAGING,
      state: "waiting_for_generation",
      updatedAt: "2026-07-13T16:00:53.175Z",
    },
  ],
  limit: 10,
})
assert.equal(pool.waitingForGenerationCount, 1)
assert.equal(pool.deferredCount, 0)
assert.equal(pool.candidates.length, 1)
assert.equal(pool.candidates[0]?.leadId, BLOCK_IMAGING)
assert.equal(pool.candidates[0]?.source, "waiting_for_generation")
console.log("  ✓ Growth 5F capacity wake can discover waiting_for_generation (deferred empty)")

// FIFO + generation-ready preferred over deferred for same lead
const pool2 = collectGenerationCapacityCandidates({
  deferredStates: [
    {
      leadId: "older-deferred",
      state: "paused",
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
  ],
  dueStates: [
    {
      leadId: BLOCK_IMAGING,
      state: "waiting_for_generation",
      updatedAt: "2026-07-13T16:00:53.175Z",
    },
    {
      leadId: "gen-older",
      state: "waiting_for_generation",
      updatedAt: "2026-07-12T16:00:00.000Z",
    },
  ],
  limit: 10,
})
assert.deepEqual(
  pool2.candidates.map((row) => row.leadId),
  ["gen-older", BLOCK_IMAGING, "older-deferred"],
)
console.log("  ✓ candidate sampling prefers generation-ready FIFO, then deferred")

// Wiring: intentional separation preserved
const tickSrc = readSource("lib/growth/draft-factory/draft-factory-due-scheduler-tick.ts")
assert.ok(tickSrc.includes("collectGenerationCapacityCandidates"))
assert.ok(tickSrc.includes("generateViaGrowth5F"))
assert.ok(tickSrc.includes("generateAndPersistAutonomousOutreachApprovalPackageForDraftFactory"))
assert.ok(tickSrc.includes("routed_to_generation_capacity_wake"))
assert.ok(tickSrc.includes("allowGeneration: false"))
assert.ok(tickSrc.includes("GROWTH_AIOS_AUTONOMY_1F_QA_MARKER"))
// Due advances must not flip allowGeneration true globally
assert.equal(
  /allowGeneration:\s*true/.test(tickSrc),
  false,
  "due advances must remain non-generative; generation only via capacity wake callback",
)
assert.ok(tickSrc.includes("buildCanonicalEvidenceForLead"))
console.log("  ✓ due tick: allowGeneration stays false; capacity wake injects Growth 5F")

const wakeSrc = readSource("lib/growth/draft-factory/draft-factory-wake-bus-observer.ts")
assert.ok(wakeSrc.includes("collectGenerationCapacityCandidates"))
assert.ok(wakeSrc.includes("generateViaGrowth5F"))
assert.ok(wakeSrc.includes("generateAndPersistAutonomousOutreachApprovalPackageForDraftFactory"))
console.log("  ✓ wake bus capacity path also discovers waiting_for_generation + Growth 5F")

const growth5f = readSource(
  "lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service.ts",
)
assert.ok(growth5f.includes("buildAutonomousOutreachApprovalPackage"))
assert.equal(/apollo|sendEmail|enrollSequence|twilio|voiceCall/i.test(tickSrc), false)
console.log("  ✓ Growth 5F remains sole generator; no outbound in due tick")

async function main() {
  // Block Imaging production-style capacity wake → one package → waiting_for_approval
  clearDurableDraftFactoryStoreForTests()
  const repo = createMemoryDraftFactoryRepository("memory")
  const now = "2026-07-13T16:20:00.000Z"
  const packageId = `growth5f:${BLOCK_IMAGING}:${now}`
  let generateCalls = 0

  const capacity = await advanceDraftFactoryCapacityWake({
    organizationId: ORG,
    capacityClass: "llm_drafting",
    capacitySlotsAvailable: 1,
    now,
    repository: repo,
    candidates: [
      {
        leadId: BLOCK_IMAGING,
        investmentState: "increase_investment",
        spendAuthorized: true,
        evidence: baseEvidence({
          decisionMakerId: "28b54a56-900c-4571-9fe6-fa9c1aaf371f",
        }),
        signals: { missionPriorityOverall: 95 },
      },
      {
        leadId: "stop-lead",
        investmentState: "stop_investment",
        spendAuthorized: false,
        evidence: baseEvidence({ stopInvestment: true }),
        signals: { missionPriorityOverall: 99 },
      },
    ],
    generateViaGrowth5F: async ({ leadId, now: generatedAt }) => {
      generateCalls += 1
      assert.equal(leadId, BLOCK_IMAGING)
      return {
        packageId: `growth5f:${leadId}:${generatedAt}`,
        pendingHumanApproval: true as const,
        transportBlocked: true as const,
      }
    },
  })

  assert.deepEqual(capacity.selectedLeadIds, [BLOCK_IMAGING])
  assert.ok(capacity.deferredLeadIds.includes("stop-lead"))
  assert.equal(generateCalls, 1)
  const blockResult = capacity.results.find((row) => row.leadId === BLOCK_IMAGING)
  assert.ok(blockResult)
  assert.equal(blockResult!.packageId, packageId)
  assert.equal(blockResult!.nextState, "waiting_for_approval")
  assert.equal(blockResult!.outcome, "completed")
  assert.ok(tickSrc.includes("pending_human_approval: true"))
  assert.ok(tickSrc.includes("transport_blocked: true"))
  console.log("  ✓ Block Imaging fixture reaches waiting_for_approval with one Growth 5F package")

  // Duplicate capacity wake must not mint a second package
  const duplicate = await advanceDraftFactoryCapacityWake({
    organizationId: ORG,
    capacityClass: "llm_drafting",
    capacitySlotsAvailable: 1,
    now: "2026-07-13T16:21:00.000Z",
    repository: repo,
    candidates: [
      {
        leadId: BLOCK_IMAGING,
        investmentState: "increase_investment",
        spendAuthorized: true,
        evidence: baseEvidence({
          draftValid: true,
          packageId,
          decisionMakerId: "28b54a56-900c-4571-9fe6-fa9c1aaf371f",
        }),
        signals: { missionPriorityOverall: 95 },
      },
    ],
    generateViaGrowth5F: async () => {
      generateCalls += 1
      return {
        packageId: `growth5f:dup:${Date.now()}`,
        pendingHumanApproval: true as const,
        transportBlocked: true as const,
      }
    },
  })
  const dupResult = duplicate.results.find((row) => row.leadId === BLOCK_IMAGING)
  assert.ok(dupResult)
  assert.ok(
    dupResult!.outcome === "duplicate_noop" || dupResult!.packageId === packageId,
    "existing package must not be regenerated",
  )
  assert.equal(generateCalls, 1, "Growth 5F must not run again for valid existing package")
  console.log("  ✓ duplicate wakes do not duplicate packages; pendingHumanApproval/transportBlocked gated")

  // Budget exhaustion defers safely (0 slots)
  const exhausted = await advanceDraftFactoryCapacityWake({
    organizationId: ORG,
    capacityClass: "llm_drafting",
    capacitySlotsAvailable: 0,
    now: "2026-07-13T16:22:00.000Z",
    repository: repo,
    candidates: [
      {
        leadId: "budget-lead",
        investmentState: "increase_investment",
        spendAuthorized: true,
        evidence: baseEvidence(),
        signals: { missionPriorityOverall: 50 },
      },
    ],
    generateViaGrowth5F: async () => {
      throw new Error("must not generate when capacity is zero")
    },
  })
  assert.equal(exhausted.selectedLeadIds.length, 0)
  assert.ok(exhausted.deferredLeadIds.includes("budget-lead"))
  console.log("  ✓ budget exhaustion defers safely; Stop Investment excluded from selection")

  const pkg = readSource("package.json")
  assert.ok(pkg.includes("test:ge-aios-autonomy-1f-draft-generation-capacity-path"))
  console.log("  ✓ package script registered")

  console.log(`\n[${GROWTH_AIOS_AUTONOMY_1F_QA_MARKER}] PASS`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
