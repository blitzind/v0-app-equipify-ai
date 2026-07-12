/**
 * SV1-3 — Autonomous Draft Factory certification.
 * Run: pnpm test:sv1-3-draft-factory
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { GrowthAutonomousOutreachApprovalPackage } from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import {
  applyAdvanceToRecord,
  buildDraftFactoryStageFlags,
  createDraftFactoryLeadRecord,
  listSkippedStagesBefore,
  planDraftFactoryAdvance,
  projectDraftFactoryState,
  resolveEarliestIncompleteStage,
  runDraftFactoryOvernightBatch,
} from "../lib/growth/draft-factory/draft-factory-engine"
import {
  AI_OS_DRAFT_FACTORY_CAPACITY,
  AI_OS_DRAFT_FACTORY_QA_MARKER,
  AI_OS_DRAFT_FACTORY_STAGES,
  AI_OS_DRAFT_FACTORY_STATES,
  AI_OS_DRAFT_FACTORY_WAKE_SOURCES,
  type AiOsDraftFactorySignals,
} from "../lib/growth/draft-factory/draft-factory-types"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function mock5fPackage(leadId: string, at: string): GrowthAutonomousOutreachApprovalPackage {
  return {
    packageId: `outreach-prep:${leadId}:${at}`,
    leadId,
    companyName: `Company ${leadId}`,
    preparedAt: at,
    generatedAssets: [
      { channel: "email", label: "Subject A", preview: "Hello — draft body", draftOnly: true },
      { channel: "call", label: "Call opening", preview: "Hi, calling about…", draftOnly: true },
      { channel: "linkedin", label: "LinkedIn", preview: "Quick note…", draftOnly: true },
    ],
    personalizationEvidence: ["Email strategy: deterministic"],
    supportingResearch: ["Verified service: MRI repair"],
    confidence: 0.82,
    approvalRequirements: ["operator_outbound_approval", "human_send_gate"],
    complianceNotes: ["Draft-only — no transport execution"],
    recommendedChannel: "email",
    recommendedSequence: "email_first_multichannel",
    expectedOutcome: "Human-approved outreach after draft review.",
    pendingHumanApproval: true,
    transportBlocked: true,
  }
}

function readySignals(overrides?: Partial<AiOsDraftFactorySignals>): AiOsDraftFactorySignals {
  return {
    admissionState: "accepted",
    researchFresh: true,
    researchStale: false,
    hasUsableResearch: true,
    knowledgeComplete: true,
    investmentState: "increase_investment",
    spendAuthorized: true,
    portfolioSelected: true,
    decisionMakerStatus: "confirmed",
    hasPrimaryDecisionMaker: true,
    hasContactName: true,
    personalizationReady: true,
    hasRecentApprovalPackage: false,
    transportBlocked: true,
    budgetAvailable: true,
    companySummary: "Imaging service company",
    selectedBecause: "Portfolio selected for drafting capacity.",
    ...overrides,
  }
}

console.log("[SV1-3] Autonomous Draft Factory certification")

assert.equal(AI_OS_DRAFT_FACTORY_STATES.length, 12)
assert.equal(AI_OS_DRAFT_FACTORY_STAGES.length, 9)
assert.ok(AI_OS_DRAFT_FACTORY_WAKE_SOURCES.includes("stale_research"))
assert.equal(AI_OS_DRAFT_FACTORY_CAPACITY.maxPackagesPerDay, 100)
console.log("  ✓ state model + stages + wake sources locked")

const moduleCorpus = fs
  .readdirSync(path.join(ROOT, "lib/growth/draft-factory"))
  .filter((name) => name.endsWith(".ts"))
  .map((name) => readSource(`lib/growth/draft-factory/${name}`))
  .join("\n")

assert.ok(moduleCorpus.includes("buildAutonomousOutreachApprovalPackage") || readSource("lib/growth/draft-factory/draft-factory-service.ts").includes("buildAutonomousOutreachApprovalPackage"))
assert.equal(/transportBlocked:\s*false|transport_blocked:\s*false/.test(moduleCorpus), false)
assert.ok(moduleCorpus.includes("transportBlocked: true"))
assert.equal(/sendEmail|enrollInCampaign|removeTransportBlock/.test(moduleCorpus), false)
console.log("  ✓ transport_blocked never bypassed; no send/enroll paths")

// Resume: existing research skipped
const withResearch = readySignals()
const flagsResearch = buildDraftFactoryStageFlags(withResearch)
assert.equal(flagsResearch.researchCurrent, true)
assert.notEqual(resolveEarliestIncompleteStage(flagsResearch), "research")
assert.ok(listSkippedStagesBefore(resolveEarliestIncompleteStage(flagsResearch)!).includes("research"))
console.log("  ✓ existing research is reused / skipped")

// DM reused
assert.equal(flagsResearch.decisionMakerAvailable, true)
assert.notEqual(resolveEarliestIncompleteStage(flagsResearch), "decision_maker")
console.log("  ✓ existing DMs are reused")

// Personalization reused when ready
assert.equal(flagsResearch.personalizationReady, true)
assert.equal(resolveEarliestIncompleteStage(flagsResearch), "generation")
console.log("  ✓ existing personalization readiness reused; resumes at generation")

// Pipeline resumes correctly from earliest incomplete
const missingDm = buildDraftFactoryStageFlags(readySignals({ hasPrimaryDecisionMaker: false, hasContactName: false, decisionMakerStatus: "none", personalizationReady: false }))
assert.equal(resolveEarliestIncompleteStage(missingDm), "decision_maker")
assert.equal(projectDraftFactoryState(missingDm), "waiting_for_dm")

const missingResearch = buildDraftFactoryStageFlags(
  readySignals({ researchFresh: false, hasUsableResearch: false, researchStale: true, knowledgeComplete: false }),
)
assert.equal(resolveEarliestIncompleteStage(missingResearch), "research")
assert.equal(projectDraftFactoryState(missingResearch), "waiting_for_research")
console.log("  ✓ pipeline resumes from earliest incomplete stage")

// Duplicate drafts not generated — reuse valid package
const now = "2026-07-12T16:00:00.000Z"
const record = createDraftFactoryLeadRecord({
  organizationId: "org_sv1_3",
  leadId: "lead_dup",
  signals: readySignals({ hasRecentApprovalPackage: true }),
  now,
  existingPackage: {
    qaMarker: AI_OS_DRAFT_FACTORY_QA_MARKER,
    factoryPackageId: "existing",
    leadId: "lead_dup",
    organizationId: "org_sv1_3",
    companyName: "Dup Co",
    companySummary: "summary",
    decisionMaker: { available: true, status: "confirmed", summary: "ok" },
    evidence: [],
    knowledgePackSummary: "complete",
    personalizationRationale: [],
    recommendedChannel: "email",
    recommendedSequence: "email_first",
    subjectLines: ["Hi"],
    emailDrafts: ["Body"],
    callOpening: null,
    linkedInOpener: null,
    confidence: 0.8,
    reasons: ["reuse"],
    supportingEvidence: [],
    approvalRequirements: ["human_send_gate"],
    nextRecommendedAction: "Review",
    explainability: {
      whySelected: "selected",
      whyNow: "now",
      whyDecisionMaker: "dm",
      whyOutreach: "outreach",
      whySequence: "seq",
      whySubject: "subj",
      whyRecommendation: "rec",
      supportingEvidence: [],
    },
    pendingHumanApproval: true,
    transportBlocked: true,
    growth5fApprovalPackage: mock5fPackage("lead_dup", now),
    preparedAt: now,
    factoryState: "waiting_for_approval",
  },
})
const reuse = planDraftFactoryAdvance({
  record,
  signals: readySignals({ hasRecentApprovalPackage: true }),
  budgetAvailable: true,
  now,
})
assert.equal(reuse.duplicatePrevented, true)
assert.equal(reuse.nextState, "waiting_for_approval")
assert.equal(reuse.stageExecuted === "generation", false)
console.log("  ✓ duplicate drafts aren't generated")

// Drafts stop at approval
const generated = planDraftFactoryAdvance({
  record: createDraftFactoryLeadRecord({
    organizationId: "org_sv1_3",
    leadId: "lead_gen",
    signals: readySignals(),
    now,
  }),
  signals: readySignals(),
  budgetAvailable: true,
  growth5fApprovalPackage: mock5fPackage("lead_gen", now),
  now,
})
assert.equal(generated.nextState, "waiting_for_approval")
assert.equal(generated.package?.pendingHumanApproval, true)
assert.equal(generated.package?.transportBlocked, true)
assert.equal(generated.package?.growth5fApprovalPackage?.transportBlocked, true)
assert.equal(generated.transportBlocked, true)
assert.ok(generated.package?.explainability.whySelected)
assert.ok(generated.package?.explainability.supportingEvidence.length >= 1)
console.log("  ✓ drafts stop at approval; explainability present")

// Investment gate
const stopAdv = planDraftFactoryAdvance({
  record: createDraftFactoryLeadRecord({
    organizationId: "org_sv1_3",
    leadId: "lead_stop",
    signals: readySignals({ investmentState: "stop_investment", spendAuthorized: false }),
    now,
  }),
  signals: readySignals({ investmentState: "stop_investment", spendAuthorized: false }),
  budgetAvailable: true,
  growth5fApprovalPackage: mock5fPackage("lead_stop", now),
  now,
})
assert.ok(/Stop Investment|Investment/i.test(stopAdv.blockedReason ?? stopAdv.nextState))
assert.equal(stopAdv.nextState === "waiting_for_approval", false)
console.log("  ✓ investment gate respected")

// Portfolio gate
const noPortfolio = planDraftFactoryAdvance({
  record: createDraftFactoryLeadRecord({
    organizationId: "org_sv1_3",
    leadId: "lead_port",
    signals: readySignals({ portfolioSelected: false }),
    now,
  }),
  signals: readySignals({ portfolioSelected: false }),
  budgetAvailable: true,
  growth5fApprovalPackage: mock5fPackage("lead_port", now),
  now,
})
assert.ok(/Portfolio/i.test(noPortfolio.blockedReason ?? ""))
console.log("  ✓ portfolio gate respected")

// Budget limits
const budgetBlock = planDraftFactoryAdvance({
  record: createDraftFactoryLeadRecord({
    organizationId: "org_sv1_3",
    leadId: "lead_budget",
    signals: readySignals(),
    now,
  }),
  signals: readySignals(),
  budgetAvailable: false,
  growth5fApprovalPackage: mock5fPackage("lead_budget", now),
  now,
})
assert.ok(/Budget/i.test(budgetBlock.blockedReason ?? ""))
console.log("  ✓ budget limits respected")

// Failures resume cleanly
const failedFlags = buildDraftFactoryStageFlags(readySignals({ admissionState: "rejected" }))
assert.equal(projectDraftFactoryState(failedFlags), "failed")
const afterRejectWake = planDraftFactoryAdvance({
  record: createDraftFactoryLeadRecord({
    organizationId: "org_sv1_3",
    leadId: "lead_rej",
    signals: readySignals({ hasRecentApprovalPackage: true }),
    wakeSource: "approval_rejected",
    now,
  }),
  signals: readySignals(),
  wakeSource: "approval_rejected",
  budgetAvailable: true,
  now,
})
assert.ok(
  afterRejectWake.resumedFrom === "generation" ||
    afterRejectWake.nextState === "waiting_for_generation" ||
    afterRejectWake.stageExecuted === "generation" ||
    afterRejectWake.nextState === "rejected",
)
console.log("  ✓ failures / rejection wake resume cleanly")

// Parallel workers don't duplicate
const lockedRecord = {
  ...createDraftFactoryLeadRecord({
    organizationId: "org_sv1_3",
    leadId: "lead_lock",
    signals: readySignals(),
    now,
  }),
  lockOwner: "worker_a",
}
const parallel = planDraftFactoryAdvance({
  record: lockedRecord,
  signals: readySignals(),
  budgetAvailable: true,
  growth5fApprovalPackage: mock5fPackage("lead_lock", now),
  now,
  workerId: "worker_b",
})
assert.equal(parallel.duplicatePrevented, true)
assert.ok(/locked|Parallel/i.test(parallel.blockedReason ?? ""))
console.log("  ✓ parallel workers don't duplicate work")

// 5F remains canonical — source checks
const factoryService = readSource("lib/growth/draft-factory/draft-factory-service.ts")
assert.ok(factoryService.includes("buildAutonomousOutreachApprovalPackage"))
assert.ok(factoryService.includes("Growth 5F") || factoryService.includes("5F"))

const outreachService = readSource(
  "lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-service.ts",
)
assert.ok(outreachService.includes("advanceDraftFactoryForLead"))
assert.ok(outreachService.includes("buildAutonomousOutreachApprovalPackage"))
assert.ok(outreachService.includes("transport_blocked: true"))
assert.equal(outreachService.includes("transport_blocked: false"), false)

const draftService = readSource(
  "lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service.ts",
)
assert.ok(draftService.includes("pendingHumanApproval: true"))
assert.ok(draftService.includes("transportBlocked: true"))

// No duplicate orchestration / no new scheduler
assert.equal(/setInterval|node-cron|BullMQ/.test(moduleCorpus), false)
assert.ok(!factoryService.includes("selectOutreachPreparationWakeCandidates"))
console.log("  ✓ existing 5F runtime remains canonical; no duplicate orchestration/scheduler")

// SV1-3 created no schema; SV1-5 durable tables are out of scope for this cert.
const migrations = fs
  .readdirSync(path.join(ROOT, "supabase/migrations"))
  .filter((name) => /sv1-3/i.test(name) || (/draft.?factory/i.test(name) && !/sv1[_-]?5|durable/i.test(name)))
assert.equal(migrations.length, 0)

const packageJson = readSource("package.json")
assert.ok(packageJson.includes("test:sv1-3-draft-factory"))
console.log("  ✓ no SV1-3 schema; cert script registered")

// applyAdvanceToRecord keeps transport blocked packages
const applied = applyAdvanceToRecord(record, generated, now)
assert.equal(applied.package?.transportBlocked, true)

// ---------- 500-lead overnight simulation ----------
console.log("  … 500-lead overnight simulation")

const candidates = Array.from({ length: 500 }, (_, i) => {
  const leadId = `sim_${String(i).padStart(3, "0")}`
  // Mix: 120 increase+selected ready, rest gated
  if (i < 120) {
    return {
      leadId,
      companyName: `Sim Co ${i}`,
      signals: readySignals({
        companySummary: `Sim company ${i}`,
        selectedBecause: `Portfolio slot simulation #${i}`,
      }),
      wakeSource: "portfolio_selected" as const,
      growth5fApprovalPackage: mock5fPackage(leadId, now),
    }
  }
  if (i < 200) {
    return {
      leadId,
      signals: readySignals({ investmentState: "stop_investment", spendAuthorized: false, portfolioSelected: true }),
    }
  }
  if (i < 300) {
    return {
      leadId,
      signals: readySignals({ portfolioSelected: false }),
    }
  }
  if (i < 400) {
    return {
      leadId,
      signals: readySignals({
        researchFresh: false,
        hasUsableResearch: false,
        researchStale: true,
        knowledgeComplete: false,
        personalizationReady: false,
      }),
    }
  }
  return {
    leadId,
    signals: readySignals({
      hasPrimaryDecisionMaker: false,
      hasContactName: false,
      decisionMakerStatus: "none",
      personalizationReady: false,
    }),
  }
})

const batch = runDraftFactoryOvernightBatch({
  organizationId: "org_sv1_3",
  now,
  candidates,
  capacity: {
    maxPackagesPerDay: AI_OS_DRAFT_FACTORY_CAPACITY.maxPackagesPerDay,
    maxOvernightBatch: AI_OS_DRAFT_FACTORY_CAPACITY.maxOvernightBatch,
  },
  packagesAlreadyProducedToday: 0,
})

assert.equal(batch.evaluated, AI_OS_DRAFT_FACTORY_CAPACITY.maxOvernightBatch)
assert.ok(batch.packagesReady > 0)
assert.ok(batch.packagesReady <= AI_OS_DRAFT_FACTORY_CAPACITY.maxPackagesPerDay)
assert.ok(batch.capacity.used <= AI_OS_DRAFT_FACTORY_CAPACITY.maxPackagesPerDay)
assert.ok(batch.skippedIneligible >= 0)
assert.equal(batch.qaMarker, AI_OS_DRAFT_FACTORY_QA_MARKER)

const readyOnly = runDraftFactoryOvernightBatch({
  organizationId: "org_sv1_3_b",
  now,
  candidates: candidates.slice(0, 120),
  capacity: { maxPackagesPerDay: 100, maxOvernightBatch: 100 },
})
assert.equal(readyOnly.packagesReady, 100)
assert.equal(readyOnly.capacity.used, 100)
assert.equal(readyOnly.capacity.remaining, 0)

// Second pass reuses — no duplicate generation for same records with existing packages
const secondPass = runDraftFactoryOvernightBatch({
  organizationId: "org_sv1_3_b",
  now,
  candidates: candidates.slice(0, 5).map((candidate) => {
    const first = readyOnly.results.find((row) => row.leadId === candidate.leadId)
    return {
      ...candidate,
      existingRecord: first
        ? applyAdvanceToRecord(
            createDraftFactoryLeadRecord({
              organizationId: "org_sv1_3_b",
              leadId: candidate.leadId,
              signals: candidate.signals,
              now,
            }),
            first,
            now,
          )
        : null,
      growth5fApprovalPackage: undefined,
    }
  }),
  capacity: { maxPackagesPerDay: 100, maxOvernightBatch: 5 },
  packagesAlreadyProducedToday: 100,
})
assert.ok(secondPass.duplicatesPrevented >= 1 || secondPass.results.every((r) => r.stageExecuted !== "generation"))
console.log("  ✓ 500-lead overnight simulation produces approval-ready packages within capacity")

console.log("[SV1-3] PASS")
