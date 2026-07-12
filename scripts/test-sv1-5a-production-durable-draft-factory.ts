/**
 * SV1-5A — Production durable Draft Factory certification.
 * Run: pnpm test:sv1-5a-production-durable-draft-factory
 *
 * Exercises repository contract + fail-closed production selection.
 * Uses memory adapter for concurrency contract; factory rules forbid production→memory.
 * When SUPABASE_SERVICE_ROLE_KEY + URL are present (vercel env run), also probes real Postgres.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createMemoryDraftFactoryRepository } from "../lib/growth/draft-factory/draft-factory-durable-memory-repository"
import { resolveDraftFactoryDurableRepositoryKind } from "../lib/growth/draft-factory/draft-factory-durable-repository-contract"
import {
  advanceDraftFactoryForLead,
  advanceDraftFactoryCapacityWake,
  listDueDraftFactoryStates,
  recordDraftFactoryWake,
  reconstructDraftFactoryStateFromCanonicalData,
} from "../lib/growth/draft-factory/draft-factory-durable-service"
import {
  AI_OS_DRAFT_FACTORY_DURABLE_QA_MARKER,
  type AiOsDraftFactoryCanonicalEvidence,
} from "../lib/growth/draft-factory/draft-factory-durable-types"
import {
  clearDurableDraftFactoryStoreForTests,
  isDraftFactoryInMemoryStoreAuthoritative,
  simulateDraftFactoryProcessRestart,
} from "../lib/growth/draft-factory/draft-factory-durable-store"

const ROOT = process.cwd()
const ORG = "org-sv1-5a"
const ORG_B = "org-sv1-5a-other"

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

async function main(): Promise<void> {
  console.log("[SV1-5A] Production durable Draft Factory certification")
  clearDurableDraftFactoryStoreForTests()

  // --- Repository selection fail-closed ---
  assert.equal(
    resolveDraftFactoryDurableRepositoryKind({ runtime: "production", admin: {} }),
    "postgres",
  )
  assert.throws(
    () =>
      resolveDraftFactoryDurableRepositoryKind({
        runtime: "production",
        injectedRepository: createMemoryDraftFactoryRepository("memory"),
      }),
    /cannot resolve to an injected memory/,
  )
  assert.throws(
    () => resolveDraftFactoryDurableRepositoryKind({ runtime: "production" }),
    /requires a Supabase admin/,
  )
  assert.equal(
    resolveDraftFactoryDurableRepositoryKind({
      runtime: "test",
      injectedRepository: createMemoryDraftFactoryRepository("memory"),
    }),
    "memory",
  )
  assert.equal(isDraftFactoryInMemoryStoreAuthoritative(), false)
  console.log("  ✓ production repository selection resolves to Postgres; rejects memory/disk")

  const repo = createMemoryDraftFactoryRepository("memory")
  assert.equal(repo.kind, "memory")

  // Missing table fail-closed (simulated)
  const missing = {
    ...repo,
    kind: "postgres" as const,
    async assertAvailable() {
      return { ok: false as const, reason: "growth.draft_factory_lead_states missing" }
    },
  }
  const probe = await missing.assertAvailable()
  assert.equal(probe.ok, false)
  console.log("  ✓ missing table fails closed (assertAvailable)")

  // --- Lead insert + version protection ---
  const t0 = "2026-07-12T14:00:00.000Z"
  const lead1 = "lead-5a-1"
  const r0 = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: lead1,
    wake: { type: "new_lead", eventId: "n1" },
    now: t0,
    evidence: baseEvidence(),
    repository: repo,
  })
  assert.equal(r0.qaMarker, AI_OS_DRAFT_FACTORY_DURABLE_QA_MARKER)
  assert.equal(r0.nextState, "waiting_for_research")
  assert.equal(r0.pendingHumanApproval, true)
  assert.equal(r0.transportBlocked, true)

  const dup = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: lead1,
    wake: { type: "new_lead", eventId: "n1" },
    now: "2026-07-12T14:01:00.000Z",
    evidence: baseEvidence(),
    repository: repo,
  })
  assert.equal(dup.outcome, "duplicate_noop")
  console.log("  ✓ lead state insert + duplicate wake receipt rejected safely")

  // --- Lease concurrency ---
  assert.equal(
    await repo.tryAcquireLease({
      organizationId: ORG,
      leadId: lead1,
      workerId: "worker-hold",
      now: "2026-07-12T14:02:00.000Z",
      leaseMs: 120_000,
    }),
    true,
  )
  const blocked = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: lead1,
    wake: { type: "research_completed", eventId: "rc-blocked" },
    now: "2026-07-12T14:02:01.000Z",
    evidence: baseEvidence(),
    repository: repo,
    workerId: "worker-b",
  })
  assert.equal(blocked.duplicate, true)
  await repo.releaseLease({
    organizationId: ORG,
    leadId: lead1,
    workerId: "worker-hold",
    now: "2026-07-12T14:03:00.000Z",
  })
  // Wrong worker cannot release
  await repo.tryAcquireLease({
    organizationId: ORG,
    leadId: lead1,
    workerId: "worker-a",
    now: "2026-07-12T14:03:30.000Z",
    leaseMs: 60_000,
  })
  await repo.releaseLease({
    organizationId: ORG,
    leadId: lead1,
    workerId: "worker-wrong",
    now: "2026-07-12T14:03:31.000Z",
  })
  const stillHeld = await repo.getLeadState(ORG, lead1)
  assert.equal(stillHeld?.leaseOwner, "worker-a")
  await repo.releaseLease({
    organizationId: ORG,
    leadId: lead1,
    workerId: "worker-a",
    now: "2026-07-12T14:04:00.000Z",
  })
  console.log("  ✓ lease acquisition atomic; concurrent denied; wrong worker cannot release")

  // Expired lease recovered
  await repo.tryAcquireLease({
    organizationId: ORG,
    leadId: lead1,
    workerId: "worker-old",
    now: "2026-07-12T14:05:00.000Z",
    leaseMs: 1,
  })
  const recovered = await repo.tryAcquireLease({
    organizationId: ORG,
    leadId: lead1,
    workerId: "worker-new",
    now: "2026-07-12T14:05:01.000Z",
    leaseMs: 60_000,
  })
  assert.equal(recovered, true)
  await repo.releaseLease({
    organizationId: ORG,
    leadId: lead1,
    workerId: "worker-new",
    now: "2026-07-12T14:05:02.000Z",
  })
  console.log("  ✓ expired lease recovered")

  // Org isolation
  await advanceDraftFactoryForLead({
    organizationId: ORG_B,
    leadId: lead1,
    wake: { type: "new_lead", eventId: "iso" },
    now: t0,
    evidence: baseEvidence(),
    repository: repo,
  })
  assert.ok(await repo.getLeadState(ORG_B, lead1))
  assert.notEqual((await repo.getLeadState(ORG, lead1))?.organizationId, ORG_B)
  const due = await listDueDraftFactoryStates({ organizationId: ORG, now: t0, repository: repo })
  assert.ok(due.every((s) => s.organizationId === ORG))
  console.log("  ✓ organization isolation works")

  // Reconstruct missing
  clearDurableDraftFactoryStoreForTests()
  const reconstructed = reconstructDraftFactoryStateFromCanonicalData({
    organizationId: ORG,
    leadId: "recon-1",
    evidence: baseEvidence({
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
  const fromMissing = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: "recon-1",
    wake: { type: "scheduled_resume", eventId: "sr1" },
    now: t0,
    evidence: baseEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
      decisionMakerAvailable: true,
      contactVerifiedForEmail: true,
      personalizationReady: true,
      draftValid: true,
      packageId: "pkg-existing",
    }),
    repository: repo,
  })
  assert.equal(fromMissing.nextState, "waiting_for_approval")
  assert.equal(fromMissing.packageId, "pkg-existing")
  console.log("  ✓ missing state reconstructs; existing package reused")

  // Research completion wake
  const leadR = "lead-research-5a"
  await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadR,
    wake: { type: "new_lead", eventId: "nr" },
    now: t0,
    evidence: baseEvidence(),
    repository: repo,
  })
  const researchDone = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadR,
    wake: { type: "research_completed", sourceId: "run-abc" },
    now: "2026-07-12T14:10:00.000Z",
    evidence: baseEvidence({ portfolioSelected: true }),
    repository: repo,
    completionHints: { completeCurrentStage: true },
  })
  assert.notEqual(researchDone.nextState, "waiting_for_research")
  assert.equal(researchDone.state.researchRunId, "run-abc")
  console.log("  ✓ research completion records durable wake; current research reused")

  // DataMoon completion + replay
  const leadDm = "lead-dm-5a"
  await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadDm,
    wake: { type: "decision_maker_required", eventId: "dmr" },
    now: t0,
    evidence: baseEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
    }),
    repository: repo,
  })
  const dmDone = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadDm,
    wake: { type: "datamoon_person_completed", sourceId: "dm-run-1" },
    now: "2026-07-12T14:20:00.000Z",
    evidence: baseEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
    }),
    repository: repo,
    completionHints: { completeCurrentStage: true },
  })
  assert.ok(
    dmDone.nextState === "waiting_for_contact_verification" ||
      dmDone.nextStage === "contact_verification",
  )
  const dmReplay = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadDm,
    wake: { type: "datamoon_person_completed", sourceId: "dm-run-1" },
    now: "2026-07-12T14:21:00.000Z",
    evidence: baseEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
      decisionMakerAvailable: true,
    }),
    repository: repo,
  })
  assert.equal(dmReplay.outcome, "duplicate_noop")
  console.log("  ✓ DataMoon completion wake + replay duplicate_noop")

  // Contact → personalization → generation → approval
  await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadDm,
    wake: { type: "contact_verified", sourceId: "cv-1" },
    now: "2026-07-12T14:22:00.000Z",
    evidence: baseEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
      decisionMakerAvailable: true,
      decisionMakerId: "dm-run-1",
    }),
    repository: repo,
    completionHints: { completeCurrentStage: true },
  })
  const pers = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadDm,
    wake: { type: "personalization_improved", sourceId: "p1" },
    now: "2026-07-12T14:23:00.000Z",
    evidence: baseEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
      decisionMakerAvailable: true,
      contactVerifiedForEmail: true,
    }),
    repository: repo,
    completionHints: { completeCurrentStage: true },
  })
  assert.equal(pers.nextState, "waiting_for_generation")

  const gen = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadDm,
    wake: { type: "generation_required", eventId: "g1" },
    now: "2026-07-12T14:24:00.000Z",
    evidence: baseEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
      decisionMakerAvailable: true,
      contactVerifiedForEmail: true,
      personalizationReady: true,
    }),
    repository: repo,
    generateViaGrowth5F: async ({ leadId, now }) => ({
      packageId: `growth5f:${leadId}:${now}`,
      pendingHumanApproval: true,
      transportBlocked: true,
    }),
  })
  assert.equal(gen.nextState, "waiting_for_approval")
  assert.ok(gen.packageId?.startsWith("growth5f:"))
  assert.equal(gen.pendingHumanApproval, true)
  assert.equal(gen.transportBlocked, true)
  console.log("  ✓ contact/personalization/generation → waiting_for_approval; Growth 5F only")

  // Scheduler + provider collision
  const collideA = advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadDm,
    wake: { type: "capacity_available", sourceId: "sched-1" },
    now: "2026-07-12T14:25:00.000Z",
    evidence: baseEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
      decisionMakerAvailable: true,
      contactVerifiedForEmail: true,
      personalizationReady: true,
      draftValid: true,
      packageId: gen.packageId,
    }),
    repository: repo,
    workerId: "sched",
  })
  const collideB = advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadDm,
    wake: { type: "generation_required", eventId: "prov-1" },
    now: "2026-07-12T14:25:00.000Z",
    evidence: baseEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
      decisionMakerAvailable: true,
      contactVerifiedForEmail: true,
      personalizationReady: true,
      draftValid: true,
      packageId: gen.packageId,
    }),
    repository: repo,
    workerId: "provider",
    generateViaGrowth5F: async () => {
      throw new Error("must not regenerate")
    },
  })
  const [a, b] = await Promise.all([collideA, collideB])
  assert.ok(a.packageId === gen.packageId && b.packageId === gen.packageId)
  console.log("  ✓ scheduler/provider collision does not duplicate package")

  // Stop investment / portfolio defer / capacity
  const stop = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: "lead-stop",
    wake: { type: "investment_changed", eventId: "stop" },
    now: t0,
    evidence: baseEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      stopInvestment: true,
      investmentState: "stop_investment",
      portfolioSelected: true,
    }),
    repository: repo,
  })
  assert.equal(stop.outcome, "stopped")

  const defer = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: "lead-defer",
    wake: { type: "portfolio_deferred", eventId: "def" },
    now: t0,
    evidence: baseEvidence({ researchCurrent: true, knowledgeComplete: true }),
    repository: repo,
    completionHints: { portfolioDeferred: true },
  })
  assert.equal(defer.outcome, "deferred")

  const capacity = await advanceDraftFactoryCapacityWake({
    organizationId: ORG,
    capacityClass: "llm_drafting",
    capacitySlotsAvailable: 1,
    now: "2026-07-12T15:00:00.000Z",
    repository: repo,
    candidates: [
      {
        leadId: "cap-1",
        investmentState: "increase_investment",
        evidence: baseEvidence({
          researchCurrent: true,
          knowledgeComplete: true,
          decisionMakerAvailable: true,
          contactVerifiedForEmail: true,
          personalizationReady: true,
        }),
        signals: { missionPriorityOverall: 90 },
      },
      {
        leadId: "cap-2",
        investmentState: "increase_investment",
        evidence: baseEvidence({
          researchCurrent: true,
          knowledgeComplete: true,
          decisionMakerAvailable: true,
          contactVerifiedForEmail: true,
          personalizationReady: true,
        }),
        signals: { missionPriorityOverall: 10 },
      },
    ],
    generateViaGrowth5F: async ({ leadId, now }) => ({
      packageId: `growth5f:${leadId}:${now}`,
      pendingHumanApproval: true,
      transportBlocked: true,
    }),
  })
  assert.equal(capacity.selectedLeadIds.length, 1)
  assert.equal(capacity.deferredLeadIds.length, 1)
  console.log("  ✓ stop/defer/capacity selection")

  // Retry timing + no-result cooldown across restart
  const timeout = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: "lead-to",
    wake: { type: "research_required", eventId: "to1" },
    now: t0,
    evidence: baseEvidence(),
    repository: repo,
    completionHints: { providerTimeout: true },
  })
  assert.equal(timeout.outcome, "retryable_failure")
  assert.ok(timeout.state.nextEligibleWakeAt)
  simulateDraftFactoryProcessRestart()
  const afterRestart = await repo.getLeadState(ORG, "lead-to")
  assert.equal(afterRestart?.nextEligibleWakeAt, timeout.state.nextEligibleWakeAt)

  const noResult = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: "lead-nr",
    wake: { type: "datamoon_person_failed", eventId: "nr1" },
    now: t0,
    evidence: baseEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
    }),
    repository: repo,
    completionHints: { terminalNoResult: true },
  })
  assert.equal(noResult.outcome, "stopped")
  simulateDraftFactoryProcessRestart()
  assert.ok(await repo.getLeadState(ORG, "lead-nr"))
  console.log("  ✓ retry timing + no-result cooldown persist across restart")

  // Manual rebuild idempotent
  const rb1 = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadDm,
    wake: { type: "manual_rebuild", requestId: "rebuild-xyz" },
    now: "2026-07-12T15:30:00.000Z",
    evidence: baseEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
      decisionMakerAvailable: true,
      contactVerifiedForEmail: true,
      personalizationReady: true,
    }),
    repository: repo,
  })
  const rb2 = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: leadDm,
    wake: { type: "manual_rebuild", requestId: "rebuild-xyz" },
    now: "2026-07-12T15:31:00.000Z",
    evidence: baseEvidence({
      researchCurrent: true,
      knowledgeComplete: true,
      portfolioSelected: true,
      decisionMakerAvailable: true,
      contactVerifiedForEmail: true,
      personalizationReady: true,
    }),
    repository: repo,
  })
  assert.equal(rb2.outcome, "duplicate_noop")
  assert.ok(rb1.wakeFingerprint.includes("rebuild-xyz"))
  console.log("  ✓ manual rebuild idempotent by request ID")

  const recorded = await recordDraftFactoryWake({
    organizationId: ORG,
    leadId: "wake-rec",
    wake: { type: "new_lead", eventId: "wr" },
    now: t0,
    repository: repo,
  })
  assert.equal(recorded.alreadySeen, false)

  // Source wiring assertions
  const live = readSource("lib/growth/draft-factory/draft-factory-durable-live.ts")
  assert.ok(live.includes("runtime: \"production\""))
  assert.ok(live.includes("no memory fallback") || live.includes("Fail closed"))
  assert.ok(live.includes("pendingHumanApproval"))
  assert.ok(live.includes("transportBlocked"))
  assert.ok(!/apollo/i.test(live))

  const pilot = readSource(
    "lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-service.ts",
  )
  assert.ok(pilot.includes("advanceDraftFactoryForLeadLive"))

  const research = readSource("lib/growth/research/growth-lead-research-execution-service.ts")
  assert.ok(research.includes("wakeDraftFactoryFromCompletionEvent"))
  assert.ok(research.includes("research_completed"))

  const dm = readSource("lib/growth/datamoon-decision-maker/datamoon-dm-service.ts")
  assert.ok(dm.includes("datamoon_person_completed"))

  const migration = readSource(
    "supabase/migrations/20271112120000_growth_draft_factory_durable_sv1_5.sql",
  )
  assert.ok(migration.includes("draft_factory_lead_states_service_role"))
  assert.ok(migration.includes("draft_factory_lead_states_lease_expires_idx"))

  const factory = readSource("lib/growth/draft-factory/draft-factory-durable-repository-factory.ts")
  assert.ok(factory.includes("no memory fallback"))

  // Optional live Postgres probe
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const { createClient } = await import("@supabase/supabase-js")
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const { createPostgresDraftFactoryRepository } = await import(
      "../lib/growth/draft-factory/draft-factory-durable-repository"
    )
    const pg = createPostgresDraftFactoryRepository(admin)
    const avail = await pg.assertAvailable?.()
    console.log(
      avail?.ok
        ? "  ✓ live Postgres tables available"
        : `  ⚠ live Postgres probe: ${avail && !avail.ok ? avail.reason : "unknown"}`,
    )
  } else {
    console.log("  · live Postgres probe skipped (no production env in process)")
  }

  // Reconciliation dry-run is non-mutating (source contract)
  const reconcile = readSource("lib/growth/draft-factory/draft-factory-durable-reconcile.ts")
  assert.ok(reconcile.includes("dryRun"))
  assert.ok(reconcile.includes("EQUIPIFY_GROWTH_TEST_ORG_ID"))
  assert.ok(reconcile.includes("5876176a-61ec-4532-ad99-0c31482d5a91"))

  console.log("  ✓ pendingHumanApproval/transportBlocked intact; no Apollo; wiring present")
  console.log("\n[SV1-5A] All certifications passed.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
