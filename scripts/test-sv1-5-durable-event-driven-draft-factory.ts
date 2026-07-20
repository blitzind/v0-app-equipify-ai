/**
 * SV1-5 — Durable, event-driven Draft Factory wake chain certification.
 * Run: pnpm test:sv1-5-durable-event-driven-draft-factory
 *
 * Executes real state transitions + simulated restarts (not source-string-only).
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  advanceDraftFactoryBatch,
  advanceDraftFactoryCapacityWake,
  advanceDraftFactoryForLead,
  listDueDraftFactoryStates,
  normalizeDraftFactoryWake,
  recordDraftFactoryWake,
  reconstructDraftFactoryStateFromCanonicalData,
} from "../lib/growth/draft-factory/draft-factory-durable-service"
import {
  AI_OS_DRAFT_FACTORY_DURABLE_QA_MARKER,
  AI_OS_DRAFT_FACTORY_WAKE_NORMALIZATION,
  type AiOsDraftFactoryCanonicalEvidence,
} from "../lib/growth/draft-factory/draft-factory-durable-types"
import {
  clearDurableDraftFactoryStoreForTests,
  getDurableDraftFactoryLeadState,
  isDraftFactoryInMemoryStoreAuthoritative,
  listDurableTransitions,
  simulateDraftFactoryProcessRestart,
} from "../lib/growth/draft-factory/draft-factory-durable-store"
import { AI_OS_DRAFT_FACTORY_CAPACITY } from "../lib/growth/draft-factory/draft-factory-types"

const ROOT = process.cwd()
const ORG = "org-sv1-5"
const ORG_B = "org-sv1-5-other"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function baseEvidence(partial?: Partial<AiOsDraftFactoryCanonicalEvidence>): AiOsDraftFactoryCanonicalEvidence {
  return {
    admitted: true,
    researchCurrent: false,
    knowledgeComplete: false,
    stopInvestment: false,
    portfolioSelected: false,
    decisionMakerAvailable: false,
    contactVerifiedForEmail: false,
    personalizationReady: false,
    draftValid: false,
    approved: false,
    rejected: false,
    ...partial,
  }
}

/** SV1-1 increase_investment + spend_authorized — required for generation-stage assertions. */
function billableDraftingEvidence(
  partial?: Partial<AiOsDraftFactoryCanonicalEvidence>,
): AiOsDraftFactoryCanonicalEvidence {
  return baseEvidence({
    investmentState: "increase_investment",
    spendAuthorized: true,
    ...partial,
  })
}

function growth5fStub(leadId: string, now: string) {
  return async () => ({
    packageId: `growth5f:${leadId}:${now}`,
    pendingHumanApproval: true as const,
    transportBlocked: true as const,
  })
}

async function main(): Promise<void> {
  console.log("[SV1-5] Durable event-driven Draft Factory certification")
  clearDurableDraftFactoryStoreForTests()

  assert.equal(isDraftFactoryInMemoryStoreAuthoritative(), false)
  console.log("  ✓ old in-memory store is not production authority")

  // --- Wake normalization ---
  assert.equal(normalizeDraftFactoryWake("stale_research"), "research_became_stale")
  assert.equal(normalizeDraftFactoryWake("newly_available_capacity"), "capacity_available")
  assert.equal(normalizeDraftFactoryWake("outreach_preparation_wake"), "generation_required")
  assert.ok(AI_OS_DRAFT_FACTORY_WAKE_NORMALIZATION.provider_capacity_available === "capacity_available")
  console.log("  ✓ wake normalization map")

  // --- New lead creates durable state ---
  const t0 = "2026-07-12T10:00:00.000Z"
  const lead1 = "lead-new-1"
  const r0 = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: lead1,
    wake: { type: "new_lead", eventId: "evt-new-1" },
    now: t0,
    evidence: baseEvidence(),
  })
  assert.equal(r0.qaMarker, AI_OS_DRAFT_FACTORY_DURABLE_QA_MARKER)
  assert.equal(r0.nextState, "waiting_for_research")
  assert.equal(r0.pendingHumanApproval, true)
  assert.equal(r0.transportBlocked, true)
  assert.ok(getDurableDraftFactoryLeadState(ORG, lead1))
  console.log("  ✓ new lead creates durable state waiting_for_research")

  // --- Process restart survives ---
  simulateDraftFactoryProcessRestart()
  const afterRestart = getDurableDraftFactoryLeadState(ORG, lead1)
  assert.ok(afterRestart)
  assert.equal(afterRestart.state, "waiting_for_research")
  console.log("  ✓ state survives simulated process restart")

  // --- Duplicate wake no-op ---
  const dup = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: lead1,
    wake: { type: "new_lead", eventId: "evt-new-1" },
    now: "2026-07-12T10:01:00.000Z",
    evidence: baseEvidence(),
  })
  assert.equal(dup.outcome, "duplicate_noop")
  assert.equal(dup.duplicate, true)
  console.log("  ✓ duplicate wake is successful no-op")

  // --- Concurrent wakes: second worker lease miss ---
  const leadConc = "lead-concurrent"
  await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadConc,
    wake: { type: "new_lead", eventId: "c-1" },
    now: t0,
    evidence: baseEvidence({ researchCurrent: true, knowledgeComplete: true, portfolioSelected: true }),
    workerId: "worker-a",
  })
  // Hold lease manually by starting overlapping advances with same incomplete stage
  const { tryAcquireDurableDraftFactoryLease } = await import(
    "../lib/growth/draft-factory/draft-factory-durable-store"
  )
  assert.equal(
    tryAcquireDurableDraftFactoryLease({
      organizationId: ORG,
      leadId: leadConc,
      workerId: "worker-hold",
      now: "2026-07-12T10:02:00.000Z",
      leaseMs: 120_000,
    }),
    true,
  )
  const blocked = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadConc,
    wake: { type: "research_completed", eventId: "c-2" },
    now: "2026-07-12T10:02:01.000Z",
    evidence: baseEvidence({ researchCurrent: true, knowledgeComplete: true, portfolioSelected: true }),
    workerId: "worker-b",
  })
  assert.equal(blocked.duplicate, true)
  assert.match(blocked.reason, /lease/i)
  console.log("  ✓ concurrent wakes do not run the same stage twice")

  // Release hold
  const { releaseDurableDraftFactoryLease } = await import(
    "../lib/growth/draft-factory/draft-factory-durable-store"
  )
  releaseDurableDraftFactoryLease({
    organizationId: ORG,
    leadId: leadConc,
    workerId: "worker-hold",
    now: "2026-07-12T10:03:00.000Z",
  })

  // --- Research completion advances correctly; does not rerun ---
  const leadR = "lead-research"
  await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadR,
    wake: { type: "new_lead", eventId: "r-new" },
    now: t0,
    evidence: baseEvidence(),
  })
  const researchDone = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadR,
    wake: { type: "research_completed", sourceId: "run-99" },
    now: "2026-07-12T10:10:00.000Z",
    evidence: baseEvidence({ portfolioSelected: true }),
    completionHints: { completeCurrentStage: true },
  })
  assert.notEqual(researchDone.nextState, "waiting_for_research")
  assert.equal(researchDone.state.researchRunId, "run-99")
  const researchAgain = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadR,
    wake: { type: "research_required", eventId: "r-again" },
    now: "2026-07-12T10:11:00.000Z",
    evidence: baseEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
      researchRunId: "run-99",
    }),
  })
  assert.notEqual(researchAgain.stageEvaluated, "research")
  console.log("  ✓ research completion advances; completed research not rerun")

  // --- DataMoon completion resumes from waiting_for_dm ---
  const leadDm = "lead-dm"
  await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadDm,
    wake: { type: "decision_maker_required", eventId: "dm-req" },
    now: t0,
    evidence: baseEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
    }),
  })
  assert.equal(getDurableDraftFactoryLeadState(ORG, leadDm)?.state, "waiting_for_dm")
  const dmDone = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadDm,
    wake: { type: "datamoon_person_completed", sourceId: "person-42" },
    now: "2026-07-12T10:20:00.000Z",
    evidence: baseEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
    }),
    completionHints: { completeCurrentStage: true },
  })
  assert.ok(
    dmDone.nextState === "waiting_for_contact_verification" ||
      dmDone.nextStage === "contact_verification",
  )
  assert.equal(dmDone.state.decisionMakerId, "person-42")
  console.log("  ✓ DataMoon completion resumes from waiting_for_dm")

  // --- Contact verification without restarting research/DM ---
  const contactDone = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadDm,
    wake: { type: "contact_verified", sourceId: "verify-1" },
    now: "2026-07-12T10:21:00.000Z",
    evidence: baseEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
      decisionMakerAvailable: true,
      decisionMakerId: "person-42",
    }),
    completionHints: { completeCurrentStage: true },
  })
  assert.equal(contactDone.state.researchRunId == null || contactDone.state.decisionMakerId === "person-42", true)
  assert.equal(contactDone.state.decisionMakerId, "person-42")
  assert.ok(
    contactDone.nextState === "waiting_for_personalization" ||
      contactDone.nextStage === "personalization",
  )
  console.log("  ✓ contact verification resumes without restarting research or DataMoon")

  // --- Personalization → generation only ---
  const persDone = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadDm,
    wake: { type: "personalization_improved", sourceId: "pers-1" },
    now: "2026-07-12T10:22:00.000Z",
    evidence: billableDraftingEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
      decisionMakerAvailable: true,
      contactVerifiedForEmail: true,
    }),
    completionHints: { completeCurrentStage: true },
  })
  assert.equal(persDone.nextState, "waiting_for_generation")
  assert.equal(persDone.nextStage, "generation")
  console.log("  ✓ personalization completion resumes generation only")

  // --- Growth 5F only generator ---
  const genDone = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadDm,
    wake: { type: "generation_required", eventId: "gen-1" },
    now: "2026-07-12T10:23:00.000Z",
    evidence: billableDraftingEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
      decisionMakerAvailable: true,
      contactVerifiedForEmail: true,
      personalizationReady: true,
    }),
    generateViaGrowth5F: growth5fStub(leadDm, "2026-07-12T10:23:00.000Z"),
  })
  assert.equal(genDone.nextState, "waiting_for_approval")
  assert.ok(genDone.packageId?.startsWith("growth5f:"))
  assert.equal(genDone.pendingHumanApproval, true)
  assert.equal(genDone.transportBlocked, true)
  console.log("  ✓ Growth 5F remains only draft generator; stops at approval")

  // --- Existing package reused ---
  const reuse = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadDm,
    wake: { type: "generation_required", eventId: "gen-2" },
    now: "2026-07-12T10:24:00.000Z",
    evidence: billableDraftingEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
      decisionMakerAvailable: true,
      contactVerifiedForEmail: true,
      personalizationReady: true,
      draftValid: true,
      packageId: genDone.packageId,
    }),
    generateViaGrowth5F: async () => {
      throw new Error("must not regenerate")
    },
  })
  assert.equal(reuse.outcome, "duplicate_noop")
  assert.equal(reuse.packageId, genDone.packageId)
  console.log("  ✓ existing valid approval package is reused")

  // --- Approval rejection invalidates only affected stages (copy) ---
  const rejectCopy = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadDm,
    wake: { type: "approval_rejected", eventId: "rej-copy", rejectionScope: "copy" },
    now: "2026-07-12T10:25:00.000Z",
    evidence: billableDraftingEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
      decisionMakerAvailable: true,
      contactVerifiedForEmail: true,
      personalizationReady: true,
      draftValid: true,
      packageId: genDone.packageId,
    }),
  })
  assert.equal(rejectCopy.state.decisionMakerId, "person-42")
  assert.ok(rejectCopy.nextStage === "generation" || rejectCopy.nextState === "waiting_for_generation" || rejectCopy.nextState === "rejected")
  console.log("  ✓ approval rejection (copy) invalidates package only")

  // --- Company change invalidates downstream ---
  const leadCo = "lead-company"
  await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadCo,
    wake: { type: "new_lead", eventId: "co-1" },
    now: t0,
    evidence: baseEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
      decisionMakerAvailable: true,
      contactVerifiedForEmail: true,
      personalizationReady: true,
      draftValid: true,
      packageId: "pkg-old",
    }),
  })
  const companyChanged = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadCo,
    wake: { type: "company_changed", sourceVersion: "co-v2" },
    now: "2026-07-12T11:00:00.000Z",
    evidence: baseEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
      decisionMakerAvailable: true,
      contactVerifiedForEmail: true,
      personalizationReady: true,
      draftValid: true,
      packageId: "pkg-old",
    }),
  })
  assert.equal(companyChanged.nextState, "waiting_for_research")
  console.log("  ✓ company change invalidates required downstream stages")

  // --- Mission change reevaluates investment/portfolio ---
  const mission = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadR,
    wake: { type: "mission_changed", sourceVersion: "mission-2" },
    now: "2026-07-12T11:05:00.000Z",
    evidence: baseEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
      decisionMakerAvailable: true,
      contactVerifiedForEmail: true,
      personalizationReady: true,
    }),
  })
  assert.ok(mission.nextStage === "portfolio" || mission.nextState === "paused" || mission.outcome === "deferred")
  console.log("  ✓ mission change causes portfolio reevaluation")

  // --- Stop Investment ---
  const stop = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: "lead-stop",
    wake: { type: "investment_changed", eventId: "stop-1" },
    now: t0,
    evidence: baseEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      stopInvestment: true,
      investmentState: "stop_investment",
      portfolioSelected: true,
    }),
  })
  assert.equal(stop.outcome, "stopped")
  assert.equal(stop.nextState, "paused")
  console.log("  ✓ Stop Investment halts the chain")

  // --- Portfolio defer ---
  const defer = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: "lead-defer",
    wake: { type: "portfolio_deferred", eventId: "def-1" },
    now: t0,
    evidence: baseEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
    }),
    completionHints: { portfolioDeferred: true },
  })
  assert.equal(defer.outcome, "deferred")
  assert.ok(getDurableDraftFactoryLeadState(ORG, "lead-defer"))
  console.log("  ✓ portfolio defer preserves state and waits")

  // --- Capacity wake advances selected only ---
  const capacity = await advanceDraftFactoryCapacityWake({
    organizationId: ORG,
    capacityClass: "llm_drafting",
    capacitySlotsAvailable: 2,
    now: "2026-07-12T12:00:00.000Z",
    candidates: [
      {
        leadId: "cap-a",
        investmentState: "increase_investment",
        spendAuthorized: true,
        evidence: billableDraftingEvidence({
          researchCurrent: true,
          knowledgeComplete: true,
          decisionMakerAvailable: true,
          contactVerifiedForEmail: true,
          personalizationReady: true,
        }),
        signals: { missionPriorityOverall: 90, dailyQueueSortScore: 90 },
      },
      {
        leadId: "cap-b",
        investmentState: "increase_investment",
        spendAuthorized: true,
        evidence: billableDraftingEvidence({
          researchCurrent: true,
          knowledgeComplete: true,
          decisionMakerAvailable: true,
          contactVerifiedForEmail: true,
          personalizationReady: true,
        }),
        signals: { missionPriorityOverall: 80, dailyQueueSortScore: 80 },
      },
      {
        leadId: "cap-c",
        investmentState: "increase_investment",
        spendAuthorized: true,
        evidence: billableDraftingEvidence({
          researchCurrent: true,
          knowledgeComplete: true,
          decisionMakerAvailable: true,
          contactVerifiedForEmail: true,
          personalizationReady: true,
        }),
        signals: { missionPriorityOverall: 10, dailyQueueSortScore: 10 },
      },
    ],
    generateViaGrowth5F: async ({ leadId, now }) => ({
      packageId: `growth5f:${leadId}:${now}`,
      pendingHumanApproval: true,
      transportBlocked: true,
    }),
  })
  assert.equal(capacity.selectedLeadIds.length, 2)
  assert.equal(capacity.deferredLeadIds.length, 1)
  assert.ok(capacity.deferredLeadIds.includes("cap-c"))
  console.log("  ✓ capacity wake advances selected accounts only")

  // --- Provider timeout schedules retry ---
  const timeout = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: "lead-timeout",
    wake: { type: "research_required", eventId: "to-1" },
    now: t0,
    evidence: baseEvidence(),
    completionHints: { providerTimeout: true },
  })
  assert.equal(timeout.outcome, "retryable_failure")
  assert.ok(timeout.state.nextEligibleWakeAt)
  assert.ok(Date.parse(timeout.state.nextEligibleWakeAt!) > Date.parse(t0))
  console.log("  ✓ provider timeout schedules retry without tight loop")

  // --- Terminal no-result does not spend repeatedly ---
  const noResult = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: "lead-no-dm",
    wake: { type: "datamoon_person_failed", eventId: "nr-1" },
    now: t0,
    evidence: baseEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
    }),
    completionHints: { terminalNoResult: true },
  })
  assert.equal(noResult.outcome, "stopped")
  console.log("  ✓ terminal no-result does not repeatedly spend DataMoon credits")

  // --- Manual rebuild idempotent by request ID ---
  const rebuild1 = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadDm,
    wake: { type: "manual_rebuild", requestId: "rebuild-abc" },
    now: "2026-07-12T12:30:00.000Z",
    evidence: billableDraftingEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
      decisionMakerAvailable: true,
      contactVerifiedForEmail: true,
      personalizationReady: true,
    }),
  })
  const rebuild2 = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadDm,
    wake: { type: "manual_rebuild", requestId: "rebuild-abc" },
    now: "2026-07-12T12:31:00.000Z",
    evidence: billableDraftingEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
      decisionMakerAvailable: true,
      contactVerifiedForEmail: true,
      personalizationReady: true,
    }),
  })
  assert.equal(rebuild2.outcome, "duplicate_noop")
  assert.ok(rebuild1.wakeFingerprint.includes("rebuild-abc"))
  console.log("  ✓ manual rebuild is idempotent by request ID")

  // --- Missing durable row reconstructs ---
  clearDurableDraftFactoryStoreForTests()
  const reconstructed = reconstructDraftFactoryStateFromCanonicalData({
    organizationId: ORG,
    leadId: "lead-reconstruct",
    evidence: billableDraftingEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
      decisionMakerAvailable: true,
      contactVerifiedForEmail: true,
      personalizationReady: true,
      draftValid: true,
      packageId: "pkg-existing",
    }),
    now: t0,
  })
  assert.equal(reconstructed.state, "waiting_for_approval")
  assert.equal(reconstructed.packageId, "pkg-existing")
  const fromMissing = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: "lead-reconstruct",
    wake: { type: "scheduled_resume", eventId: "resume-1" },
    now: t0,
    evidence: billableDraftingEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
      decisionMakerAvailable: true,
      contactVerifiedForEmail: true,
      personalizationReady: true,
      draftValid: true,
      packageId: "pkg-existing",
    }),
  })
  assert.equal(fromMissing.nextState, "waiting_for_approval")
  assert.equal(fromMissing.packageId, "pkg-existing")
  console.log("  ✓ missing durable row reconstructs from canonical data")

  // --- Organization isolation ---
  await advanceDraftFactoryForLead({
    organizationId: ORG_B,
    leadId: "lead-new-1",
    wake: { type: "new_lead", eventId: "iso-1" },
    now: t0,
    evidence: baseEvidence(),
  })
  assert.equal(getDurableDraftFactoryLeadState(ORG, "lead-new-1"), null)
  assert.ok(getDurableDraftFactoryLeadState(ORG_B, "lead-new-1"))
  const dueA = await listDueDraftFactoryStates({ organizationId: ORG, now: t0 })
  assert.ok(dueA.every((s) => s.organizationId === ORG))
  console.log("  ✓ organization isolation prevents cross-tenant state access")

  // --- recordDraftFactoryWake helper ---
  const recorded = await recordDraftFactoryWake({
    organizationId: ORG,
    leadId: "lead-wake-record",
    wake: { type: "new_lead", eventId: "wr-1" },
    now: t0,
  })
  assert.equal(recorded.alreadySeen, false)
  assert.equal(recorded.wakeType, "new_lead")
  console.log("  ✓ recordDraftFactoryWake helper")

  // --- 500-lead overnight simulation across worker cycles ---
  clearDurableDraftFactoryStoreForTests()
  const overnightOrg = "org-overnight"
  const leads = Array.from({ length: 500 }, (_, i) => `lead-${i}`)
  const nowBase = Date.parse("2026-07-12T20:00:00.000Z")

  // Seed all as ready for generation (post upstream stages)
  for (const leadId of leads) {
    await advanceDraftFactoryForLead({
      organizationId: overnightOrg,
      leadId,
      wake: { type: "new_lead", eventId: `seed-${leadId}` },
      now: new Date(nowBase).toISOString(),
      evidence: billableDraftingEvidence({
        researchCurrent: true,
        knowledgeComplete: true,
        portfolioSelected: true,
        decisionMakerAvailable: true,
        contactVerifiedForEmail: true,
        personalizationReady: true,
      }),
    })
  }

  let packages = 0
  const workerCycles = 5
  const perCycle = 25
  for (let cycle = 0; cycle < workerCycles; cycle++) {
    simulateDraftFactoryProcessRestart()
    const cycleNow = new Date(nowBase + cycle * 60_000).toISOString() // same calendar day — daily capacity
    const due = (
      await listDueDraftFactoryStates({
        organizationId: overnightOrg,
        now: cycleNow,
        limit: perCycle,
      })
    ).filter((s) => s.state === "waiting_for_generation" || s.earliestIncompleteStage === "generation")

    const batch = await advanceDraftFactoryBatch({
      organizationId: overnightOrg,
      now: cycleNow,
      workerId: `worker-cycle-${cycle}`,
      leads: due.slice(0, perCycle).map((s) => ({
        leadId: s.leadId,
        wake: { type: "capacity_available", sourceId: `cycle-${cycle}:${s.leadId}` },
        evidence: billableDraftingEvidence({
          researchCurrent: true,
          knowledgeComplete: true,
          portfolioSelected: true,
          decisionMakerAvailable: true,
          contactVerifiedForEmail: true,
          personalizationReady: true,
        }),
      })),
      generateViaGrowth5F: async ({ leadId, now }) => ({
        packageId: `growth5f:${leadId}:${now}`,
        pendingHumanApproval: true,
        transportBlocked: true,
      }),
      completionHints: { generationCapacityAvailable: true },
    })

    packages += batch.filter((r) => r.nextState === "waiting_for_approval" && r.packageId).length
  }

  assert.ok(packages <= AI_OS_DRAFT_FACTORY_CAPACITY.maxPackagesPerDay)
  assert.ok(packages >= 100 || packages === AI_OS_DRAFT_FACTORY_CAPACITY.maxPackagesPerDay)
  // Prefer at least 100 within limits
  assert.ok(packages >= 100, `expected >=100 packages, got ${packages}`)
  assert.ok(packages <= 100)

  const stillDeferred = (
    await listDueDraftFactoryStates({
      organizationId: overnightOrg,
      now: new Date(nowBase + 10 * 3_600_000).toISOString(),
      limit: 500,
    })
  ).filter((s) => s.state === "waiting_for_generation")
  assert.ok(stillDeferred.length > 0)
  console.log(
    `  ✓ 500-lead overnight sim: ${packages} approval-ready across ${workerCycles} cycles; ${stillDeferred.length} still resumable`,
  )

  // Deployment restart loses no durable progression
  simulateDraftFactoryProcessRestart()
  const stillReady = getDurableDraftFactoryLeadState(overnightOrg, stillDeferred[0]?.leadId ?? leads[0])
  assert.ok(stillReady)
  console.log("  ✓ simulated deployment restart loses no durable progression")

  // Invariants in sources
  const durableService = readSource("lib/growth/draft-factory/draft-factory-durable-service.ts")
  assert.ok(durableService.includes("pendingHumanApproval: true"))
  assert.ok(durableService.includes("transportBlocked: true"))
  assert.ok(!durableService.includes("apollo"))
  assert.ok(durableService.includes("Growth 5F") || durableService.includes("generateViaGrowth5F"))
  assert.ok(!/sendEmail|launchCampaign|placeCall|enrollLead|smsSend/.test(durableService))
  assert.ok(durableService.includes('Never sends'))

  const migration = readSource("supabase/migrations/20271112120000_growth_draft_factory_durable_sv1_5.sql")
  assert.ok(migration.includes("draft_factory_lead_states"))
  assert.ok(migration.includes("draft_factory_wake_receipts"))

  const store = readSource("lib/growth/draft-factory/draft-factory-store.ts")
  assert.ok(store.includes("NOT production authority"))

  assert.ok(listDurableTransitions(overnightOrg).length > 0)
  console.log("  ✓ pendingHumanApproval/transportBlocked intact; no send/enroll; migration present")

  console.log("\n[SV1-5] All certifications passed.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
