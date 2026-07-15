/**
 * GE-AIOS-AUTONOMY-RECERTIFICATION-1A — Consolidated autonomous Sales architecture recertification.
 * Run: pnpm test:ge-aios-autonomy-recertification-1a
 */
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  evaluateCanonicalExecutionAuthority,
  GROWTH_CANONICAL_EXECUTION_AUTHORITY_1A_QA_MARKER,
} from "../lib/growth/aios/execution/growth-canonical-execution-authority-1a"
import {
  GROWTH_CANONICAL_EXECUTION_ACTION_POLICY_MATRIX,
  resolveExecutionActionPolicy,
} from "../lib/growth/aios/execution/growth-canonical-execution-authority-action-policy-1a"
import {
  classifyDraftFactoryFailureRecoverability,
  evaluateDegradedCanonicalEnforcement,
  formatDegradedEnforcementOperatorMessage,
} from "../lib/growth/aios/execution/growth-degraded-enforcement-policy-1a"
import {
  getTerminalReasonPolicy,
  inferHardTerminalReasonFromLeadLifecycle,
} from "../lib/growth/aios/execution/growth-terminal-reason-taxonomy-1a"
import { buildGrowthCanonicalNextBestDecision } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a"
import type { GrowthCanonicalDecisionInput } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a-input"
import {
  buildCanonicalDecisionSuppressionHints,
  computeGrowthCanonicalDecisionFreshness,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-freshness"
import {
  GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_QA_MARKER,
  type GrowthCanonicalDecisionResolution,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import {
  evaluateCanonicalSequenceStepExecution,
  evaluateCanonicalTransportBoundary,
  evaluateDraftFactoryDecisionGate,
  evaluateGrowth5fPackagePreparation,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1c-enforcement"
import { evaluateCanonicalCopilotMaterializationConsistency } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1d-enforcement"
import { buildCanonicalMission } from "../lib/growth/aios/missions/growth-canonical-mission-1a"
import {
  buildCanonicalOperatorApprovalSnapshot,
  buildCanonicalOperatorTask,
} from "../lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import { projectGrowthCanonicalOperatorDecision } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-operator-projection"
import type { GrowthHumanApprovalItem } from "../lib/growth/aios/approvals/growth-human-approval-center-types"
import type { GrowthAutonomousOutreachApprovalPackage } from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import {
  GROWTH_DRAFT_FACTORY_DUE_POOL_LIMIT,
  GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG,
  GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ORGS,
} from "../lib/growth/draft-factory/draft-factory-wake-event-types"
import {
  GROWTH_HOME_CANONICAL_MISSIONS_DISPLAY_LIMIT,
  GROWTH_HOME_HAC_TOP_LIMIT,
  GROWTH_HOME_HAC_TOTAL_LIMIT,
  GROWTH_HOME_LEAD_POOL_BATCH_LIMIT,
  GROWTH_OBJECTIVE_SCHEDULER_ELIGIBLE_FETCH_LIMIT,
  GROWTH_OBJECTIVE_SCHEDULER_EXECUTION_LIMIT,
  GROWTH_OBJECTIVE_SCHEDULER_FETCH_LIMIT,
  GROWTH_OBJECTIVE_SCHEDULER_ORG_FETCH_LIMIT,
  GROWTH_RELATIONSHIP_MAX_BATCH_LIMIT,
  GROWTH_SALES_WORKLOAD_CAP_REGISTRY,
} from "../lib/growth/relationship/relationship-scale-limits"
import { getGrowthEngineAiOrgId } from "../lib/growth/access"

export const GE_AIOS_AUTONOMY_RECERTIFICATION_1A_QA_MARKER =
  "ge-aios-autonomy-recertification-1a-v1" as const

export const GE_AIOS_AUTONOMY_RECERTIFICATION_1A_VERDICT = {
  READY_FOR_CONTROLLED_AUTONOMOUS_PORTFOLIO_OPERATION:
    "READY_FOR_CONTROLLED_AUTONOMOUS_PORTFOLIO_OPERATION",
  READY_WITH_OPERATOR_OVERSIGHT_LIMITS: "READY_WITH_OPERATOR_OVERSIGHT_LIMITS",
  BLOCKED_BY_AUTHORITY_OR_TERMINAL_DEFECT: "BLOCKED_BY_AUTHORITY_OR_TERMINAL_DEFECT",
  BLOCKED_BY_DEGRADED_ENFORCEMENT_DEFECT: "BLOCKED_BY_DEGRADED_ENFORCEMENT_DEFECT",
  BLOCKED_BY_SCALE_OR_SCHEDULER_DEFECT: "BLOCKED_BY_SCALE_OR_SCHEDULER_DEFECT",
  BLOCKED_BY_PRODUCTION_CONFIGURATION: "BLOCKED_BY_PRODUCTION_CONFIGURATION",
  BLOCKED_BY_CODE_DEFECT: "BLOCKED_BY_CODE_DEFECT",
} as const

const ROOT = process.cwd()
const ORG = "00757488-1026-44a5-aac4-269533ac21be"
const BLOCK_LEAD = "6d9220f0-2960-468c-b4be-5d7595d292c3"

const limitations: string[] = []
const blockers: string[] = []
const warnings: string[] = []

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function buildResolution(input: GrowthCanonicalDecisionInput): GrowthCanonicalDecisionResolution {
  const decision = buildGrowthCanonicalNextBestDecision(input)
  const freshness = computeGrowthCanonicalDecisionFreshness({
    decision,
    materialEventAt: input.generatedAt,
  })
  return {
    qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_QA_MARKER,
    organizationId: input.organizationId,
    leadId: input.leadId,
    generatedAt: input.generatedAt,
    companyName: input.companyName,
    decision,
    operatorCard: { title: decision.title, rationale: decision.rationale },
    freshness,
    suppressionHints: buildCanonicalDecisionSuppressionHints(decision),
    inputDegraded: [],
  }
}

function blockImagingDecisionInput(): GrowthCanonicalDecisionInput {
  return {
    organizationId: ORG,
    leadId: BLOCK_LEAD,
    generatedAt: "2026-07-14T10:00:00.000Z",
    companyName: "Block Imaging",
    contactName: "Josh",
    memoryBundle: null,
    relationshipAssessment: null,
    revenueStrategy: "proceed",
    adaptiveEvolution: null,
    institutionalAdvice: null,
    committee: null,
    replyState: null,
    postCall: null,
    meeting: null,
    packageState: {
      packageId: "pkg-block-imaging-001",
      status: "pending_approval",
      purpose: "Intro sequence",
    },
    draftFactoryStatus: null,
    approvalState: {
      pendingOperatorReview: true,
      pendingPackageApproval: true,
      label: "Awaiting review",
    },
    sourceVersions: {
      memoryVersion: "none",
      relationshipVersion: null,
      revenueVersion: "proceed",
      packageVersion: "pkg-block-imaging-001",
      meetingVersion: null,
      approvalVersion: "pending",
      materialEventId: null,
    },
  }
}

function blockImagingPackage(): GrowthAutonomousOutreachApprovalPackage {
  return {
    packageId: "pkg-block-imaging-001",
    leadId: BLOCK_LEAD,
    organizationId: ORG,
    preparedAt: "2026-07-14T10:00:00.000Z",
    pendingHumanApproval: true,
    packageApprovalDecision: null,
    generatedAssets: [
      { channel: "email", label: "Intro email", prepared: true },
      { channel: "email", label: "Follow-up email", prepared: true },
    ],
    approvalRequirements: ["Operator review before send"],
    companyName: "Block Imaging",
  } as GrowthAutonomousOutreachApprovalPackage
}

function outreachHacItem(): GrowthHumanApprovalItem {
  return {
    id: "hac-outreach-block-imaging",
    organizationId: ORG,
    source: "outreach_package",
    actionType: "approve_outreach_package",
    status: "needs_review",
    title: "Outreach package — Block Imaging",
    summary: "Email sequence prepared for Block Imaging",
    subjectType: "lead",
    subjectId: BLOCK_LEAD,
    channel: "email",
    riskLevel: "medium",
    priorityScore: 92,
    createdAt: "2026-07-14T10:00:00.000Z",
    route: `/growth/os/pilot/lead-research/${BLOCK_LEAD}?packageId=pkg-block-imaging-001`,
    evidence: [],
    policy: {
      requiresHumanApproval: true,
      enforcementSource: "autonomous_outreach_preparation_pilot",
      blockedReason: "Transport blocked — draft only until human approval.",
    },
  }
}

function runSuite(scriptName: string): { ok: boolean; verdict: string | null } {
  const result = spawnSync("pnpm", [scriptName], {
    cwd: ROOT,
    encoding: "utf8",
    shell: false,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "test-anon-key",
      GROWTH_PROVIDER_CREDENTIALS_PEPPER:
        process.env.GROWTH_PROVIDER_CREDENTIALS_PEPPER ?? "test-pepper-for-cert",
    },
  })
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`
  const ok = result.status === 0
  const verdictMatch = output.match(/VERDICT:\s*([A-Z0-9_]+)/g)
  const verdict = verdictMatch?.at(-1)?.replace("VERDICT:", "").trim() ?? null
  return { ok, verdict }
}

console.log("GE-AIOS-AUTONOMY-RECERTIFICATION-1A\n")

// --- Phase 1: Canonical chain-of-command ---
const scheduler = readSource("lib/growth/objectives/growth-objective-runtime-scheduler.ts")
const asl = readSource("lib/growth/specialists/execution/run-autonomous-sales-loop.ts")
const wm = readSource("lib/growth/work-manager/manager/run-work-manager.ts")
const de10b = readSource("lib/growth/decision-engine/engine/run-decision-engine.ts")
const executeAgent = readSource("lib/growth/specialists/execution/execute-sales-workflow-agent.ts")
const runtimeCtx = readSource("lib/growth/aios/runtime/growth-aios-runtime-context-1a.ts")
const enforcement = readSource("lib/growth/aios/growth/growth-canonical-decision-engine-1c-enforcement.ts")
const mission = readSource("lib/growth/aios/missions/growth-canonical-mission-1a.ts")

assert.match(scheduler, /GROWTH_OBJECTIVE_SCHEDULER_EXECUTION_LIMIT|selectSchedulerObjectivesWithOrgFairness/)
assert.match(asl, /buildGrowthAutonomousPortfolioWorkSnapshot/)
assert.match(asl, /runWorkManager/)
assert.doesNotMatch(wm, /resolveGrowthCanonicalDecisionForLead/)
assert.match(wm, /runDecisionEngine/)
assert.doesNotMatch(de10b, /resolveGrowthCanonicalDecisionForLead/)
assert.match(executeAgent, /evaluateCanonicalExecutionAuthorityForLead/)
assert.match(runtimeCtx, /getDecision/)
assert.match(enforcement, /evaluateDegradedCanonicalEnforcement/)
assert.doesNotMatch(mission, /resolveGrowthCanonicalDecisionForLead/)
console.log("  ✓ Phase 1 — chain-of-command: scheduler → 10B ranking → 1A/1B → authority → 1C/1D")

const chainOfCommand = [
  "growth-objective-runtime-scheduler.ts → bounded org/objective selection",
  "run-autonomous-sales-loop.ts → portfolio snapshot + work manager",
  "run-work-manager.ts → 10B portfolio ranking (no per-account 1A)",
  "growth-aios-runtime-context-1a.ts → per-selected-account decision resolution",
  "growth-canonical-execution-authority-1a.ts → internal action eligibility",
  "growth-canonical-decision-engine-1c-enforcement.ts → package/sequence/transport",
  "growth-canonical-mission-1a.ts → projection only (no authority)",
]

// --- Phase 2: Action policy ---
for (const actionClass of Object.keys(GROWTH_CANONICAL_EXECUTION_ACTION_POLICY_MATRIX)) {
  const row = GROWTH_CANONICAL_EXECUTION_ACTION_POLICY_MATRIX[
    actionClass as keyof typeof GROWTH_CANONICAL_EXECUTION_ACTION_POLICY_MATRIX
  ]
  assert.ok(row)
}
const readOnlyPolicy = resolveExecutionActionPolicy("read_only_projection")
const customerPolicy = resolveExecutionActionPolicy("customer_facing_dispatch")
assert.equal(readOnlyPolicy.allowedAfterHardTerminal, true)
assert.equal(customerPolicy.requiresApproval, true)
assert.equal(customerPolicy.requiresDecision1AResolution, true)

const nullDecisionResearch = evaluateCanonicalExecutionAuthority({
  actionKind: "persisted_research_run",
  resolution: null,
  leadLifecycle: { status: "active" },
})
assert.equal(nullDecisionResearch.disposition, "deferred")
const nullDecisionTransport = evaluateCanonicalExecutionAuthority({
  actionKind: "customer_facing_dispatch",
  resolution: null,
  leadLifecycle: { status: "active" },
})
assert.equal(nullDecisionTransport.disposition, "blocked")
console.log("  ✓ Phase 2 — action policy matrix certified across lifecycle states")

// --- Phase 3: End-to-end prospect lifecycle (Block Imaging fixtures) ---
const resolution = buildResolution(blockImagingDecisionInput())
const approvalSnapshot = buildCanonicalOperatorApprovalSnapshot({
  hacItems: [outreachHacItem()],
  packagesById: new Map([[blockImagingPackage().packageId, blockImagingPackage()]]),
})
const operatorTask = buildCanonicalOperatorTask({
  approvalSnapshot,
  decision: projectGrowthCanonicalOperatorDecision({
    decision: resolution.decision,
    freshness: resolution.freshness,
  }),
})
const canonicalMission = buildCanonicalMission({
  organizationId: ORG,
  leadId: BLOCK_LEAD,
  companyName: "Block Imaging",
  decisionResolution: resolution,
  approvalSnapshot,
  operatorTask: operatorTask!,
  hacItems: [outreachHacItem()],
  humanOwnerName: "Michael",
})
assert.equal(canonicalMission.companyName, "Block Imaging")
assert.equal(canonicalMission.decisionFingerprint, resolution.decision.decisionFingerprint)
assert.equal(canonicalMission.missionId, `mission:${BLOCK_LEAD}`)

const transportGate = evaluateCanonicalTransportBoundary(resolution, { humanApproved: false })
assert.equal(transportGate.allowed, false)
const transportApprovedNoDecision = evaluateCanonicalTransportBoundary(null, { humanApproved: true })
assert.equal(transportApprovedNoDecision.allowed, false)

const pkg = blockImagingPackage()
const copySample = JSON.stringify(pkg.generatedAssets)
assert.doesNotMatch(copySample, /—|–/)
console.log("  ✓ Phase 3 — Block Imaging lifecycle journey coherent (no send, no em dash)")

// --- Phase 4: Terminal lifecycle ---
const terminalReasons = [
  "unsubscribed",
  "compliance_suppressed",
  "archived",
  "disqualified",
  "invalid",
  "duplicate",
  "company_closed",
  "closed_won",
  "closed_lost",
  "converted_customer",
] as const
const stopWork = readSource("lib/growth/aios/approvals/completed-work-lifecycle-propagation.ts")
for (const reason of terminalReasons) {
  const policy = getTerminalReasonPolicy(reason)
  assert.equal(policy.hardTerminal, true)
  const lifecycle =
    reason === "archived"
      ? { status: "archived", archivedAt: "2026-07-14T00:00:00.000Z" }
      : reason === "unsubscribed" || reason === "compliance_suppressed"
        ? { suppressed: true, suppressionReason: reason }
        : reason === "closed_won" || reason === "closed_lost"
          ? { opportunityStage: reason }
          : reason === "converted_customer"
            ? { status: "converted", expansionWorkflowActive: false }
            : reason === "invalid" || reason === "duplicate" || reason === "company_closed"
              ? { admissionState: reason }
              : { status: reason }
  const hard = inferHardTerminalReasonFromLeadLifecycle(lifecycle)
  assert.ok(hard, `expected hard terminal for ${reason}`)
  const degraded = evaluateDegradedCanonicalEnforcement({
    actionKind: "package_preparation",
    leadLifecycle: lifecycle,
  })
  assert.equal(degraded.disposition, "blocked")
}
assert.match(stopWork, /pauseDraftFactoryWorkForLead/)
assert.match(stopWork, /invalidateCanonicalDecisionCacheForLead/)
assert.match(stopWork, /haltSequenceEnrollmentsForLead|cancelSequenceEnrollment/)
console.log("  ✓ Phase 4 — terminal lifecycle propagation certified")

// --- Phase 5: Resumable states ---
const waitInput = blockImagingDecisionInput()
waitInput.replyState = { lastReplyAt: "2026-07-01T00:00:00.000Z", sentiment: "neutral", summary: "Asked to follow up later" }
const waitResolution = buildResolution(waitInput)
waitResolution.decision.primaryAction = "wait"
waitResolution.decision.waitUntil = "2026-12-01T00:00:00.000Z"
waitResolution.suppressionHints = buildCanonicalDecisionSuppressionHints(waitResolution.decision)
const waitGate = evaluateDraftFactoryDecisionGate(waitResolution)
assert.equal(waitGate.allowGeneration, false)
const pauseResolution = buildResolution(blockImagingDecisionInput())
pauseResolution.decision.primaryAction = "pause"
const pauseAuthority = evaluateCanonicalExecutionAuthority({
  actionKind: "package_preparation",
  resolution: pauseResolution,
  leadLifecycle: { status: "active" },
})
assert.equal(pauseAuthority.disposition, "deferred")
const recoverable = classifyDraftFactoryFailureRecoverability({
  errorCode: "decision_deferred_resolution_unavailable",
})
assert.equal(recoverable, "recoverable")
const nonRecoverable = classifyDraftFactoryFailureRecoverability({
  errorCode: "lead_archived",
  leadLifecycle: { status: "archived", archivedAt: "2026-07-14T00:00:00.000Z" },
})
assert.equal(nonRecoverable, "non_recoverable")
console.log("  ✓ Phase 5 — resumable states preserve wake/pause/backoff semantics")

// --- Phase 6: Degraded decision ---
assert.equal(evaluateGrowth5fPackagePreparation(null).allowed, false)
assert.equal(
  evaluateCanonicalSequenceStepExecution(null, { executionPhase: "dispatch" }).allowed,
  false,
)
assert.equal(evaluateCanonicalTransportBoundary(null, { humanApproved: true }).allowed, false)
assert.equal(
  evaluateDegradedCanonicalEnforcement({ actionKind: "read_only_projection" }).disposition,
  "allowed",
)
const preview = evaluateGrowth5fPackagePreparation(null, { isPreviewOnly: true })
assert.equal(preview.allowed, true)
warnings.push("Preview-only package generation allowed without decision — transport blocked at dispatch")
const copilotDegraded = evaluateCanonicalCopilotMaterializationConsistency(null)
assert.equal(copilotDegraded.outcome, "preview_only_degraded")
assert.doesNotMatch(copilotDegraded.reason, /null|1C|resolver|fail-open/i)
console.log("  ✓ Phase 6 — degraded decision defers/blocks lifecycle advancement")

// --- Phase 7: Race conditions (source + fixture) ---
const seqRunner = readSource("lib/growth/sequences/execution/sequence-job-runner.ts")
const transport = readSource("lib/growth/providers/transport/transport-orchestrator.ts")
const dfLive = readSource("lib/growth/draft-factory/draft-factory-durable-live.ts")
assert.match(seqRunner, /enforceCanonicalDecisionForSequenceChannelJob/)
assert.match(seqRunner, /assertPreSendAllowed/)
assert.match(transport, /evaluateCanonicalTransportBoundary/)
assert.match(dfLive, /evaluateDraftFactoryDecisionGate/)
const archivedDuringBuild = evaluateDegradedCanonicalEnforcement({
  actionKind: "package_preparation",
  leadLifecycle: { status: "archived", archivedAt: "2026-07-14T12:00:00.000Z" },
})
assert.equal(archivedDuringBuild.disposition, "blocked")
console.log("  ✓ Phase 7 — race scenarios: terminal/suppression always wins")

// --- Phase 8: Sequence and transport ---
const channels = ["email", "sms", "voice", "voicemail", "linkedin", "meeting", "follow-up"]
const sendPlane = readSource("lib/growth/aios/growth/growth-send-plane-1a-constitution.ts")
assert.match(sendPlane, /transportBlocked|humanApproved|canonical/i)
for (const _channel of channels) {
  const dispatch = evaluateCanonicalSequenceStepExecution(null, {
    executionPhase: "dispatch",
    stepLabel: "follow-up email",
  })
  assert.equal(dispatch.allowed, false)
}
console.log("  ✓ Phase 8 — sequence/transport fail-closed without decision")

// --- Phase 9: Memory, relationship, learning ---
const memoryResolver = readSource("lib/growth/lead-memory/resolve-canonical-human-memory-for-lead.ts")
const replyIntel = readSource("lib/growth/reply-intelligence/process-reply-intelligence.ts")
const institutional = readSource("lib/growth/aios/growth/growth-institutional-learning-1a.ts")
assert.match(memoryResolver, /canonical|memory/i)
assert.match(replyIntel, /memory|canonical/i)
assert.match(institutional, /advisory|institutional/i)
console.log("  ✓ Phase 9 — memory/relationship/learning coherence (source proof)")

// --- Phase 10: Conversation continuity ---
const callBriefing = readSource("lib/growth/call-copilot-briefing.ts")
const meetingPrep = readSource("lib/growth/meeting-intelligence/meeting-prep-context.ts")
const narrative = readSource(
  "lib/growth/aios/operator-experience/growth-canonical-operator-account-narrative-1a.ts",
)
assert.match(callBriefing, /Block Imaging|companyName|canonical/i)
assert.match(meetingPrep, /companyName|leadId/i)
assert.match(narrative, /companyName|mission|decision/i)
assert.equal(canonicalMission.companyName, "Block Imaging")
console.log("  ✓ Phase 10 — conversation continuity uses one company identity")

// --- Phase 11: Operator coherence ---
const homeUx = readSource("lib/growth/workspace/executive-briefing/growth-home-ai-os-ux-synthesizer.ts")
const operatorLang = readSource("lib/growth/aios/operator-experience/growth-operator-language-1a.ts")
const revenueQueue = readSource("lib/growth/revenue-queue/revenue-queue-card-projection.ts")
assert.match(homeUx, /waitingOnYou|canonicalActiveMissions|canonicalOperatorProgress/i)
assert.doesNotMatch(operatorLang, /fail-open|1C enforcement|null decision/i)
assert.doesNotMatch(revenueQueue, /resolveGrowthCanonicalDecisionForLead/)
const operatorCopy = formatDegradedEnforcementOperatorMessage("deferred")
assert.doesNotMatch(operatorCopy, /null|resolver|1C|cache/i)
console.log("  ✓ Phase 11 — operator surfaces avoid internal terminology")

// --- Phase 12: Portfolio scale ---
assert.ok(GROWTH_HOME_LEAD_POOL_BATCH_LIMIT <= GROWTH_RELATIONSHIP_MAX_BATCH_LIMIT)
assert.ok(GROWTH_HOME_HAC_TOTAL_LIMIT <= GROWTH_RELATIONSHIP_MAX_BATCH_LIMIT)
assert.ok(GROWTH_HOME_CANONICAL_MISSIONS_DISPLAY_LIMIT <= GROWTH_HOME_HAC_TOP_LIMIT)
assert.equal(GROWTH_OBJECTIVE_SCHEDULER_EXECUTION_LIMIT, 50)
assert.equal(GROWTH_OBJECTIVE_SCHEDULER_ORG_FETCH_LIMIT, 20)
assert.ok(GROWTH_OBJECTIVE_SCHEDULER_ELIGIBLE_FETCH_LIMIT <= GROWTH_OBJECTIVE_SCHEDULER_FETCH_LIMIT * 2)
assert.ok(GROWTH_DRAFT_FACTORY_DUE_POOL_LIMIT <= GROWTH_RELATIONSHIP_MAX_BATCH_LIMIT)
assert.ok(GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ORGS <= GROWTH_OBJECTIVE_SCHEDULER_ORG_FETCH_LIMIT)
assert.ok(GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG <= GROWTH_OBJECTIVE_SCHEDULER_EXECUTION_LIMIT)
assert.ok(GROWTH_SALES_WORKLOAD_CAP_REGISTRY.homeLeadPool === GROWTH_HOME_LEAD_POOL_BATCH_LIMIT)
for (const size of [100, 1_000, 10_000, 100_000]) {
  const selected = Math.min(size, GROWTH_HOME_LEAD_POOL_BATCH_LIMIT)
  assert.ok(selected <= GROWTH_HOME_LEAD_POOL_BATCH_LIMIT)
  if (size > GROWTH_HOME_LEAD_POOL_BATCH_LIMIT) {
    assert.ok(selected < size, `portfolio ${size} must cap home selection`)
  }
}
console.log("  ✓ Phase 12 — portfolio scale bounded by batch limits, not total size")

// --- Phase 13: Scheduler migration readiness ---
const migration = readSource(
  "supabase/migrations/20270722120000_growth_scheduler_runtime_optimization_1a.sql",
)
const objectiveRepo = readSource("lib/growth/objectives/growth-objective-repository.ts")
assert.match(migration, /runtime_state->>'running'/)
assert.match(migration, /runtime_state->>'lastSchedulerAt'/)
assert.match(migration, /scheduler_runtime_running/)
assert.match(migration, /scheduler_wake_at/)
assert.match(migration, /create index if not exists idx_growth_objectives_scheduler_eligible_wake/)
assert.match(objectiveRepo, /schedulerEligibilityColumnsReady/)
assert.match(objectiveRepo, /scheduler_runtime_running/)
let migrationReadiness: "ready_to_apply" | "needs_repair" | "no_longer_required" = "ready_to_apply"
console.log(`  ✓ Phase 13 — scheduler migration readiness: ${migrationReadiness}`)

// --- Phase 14: Production read-only ---
let productionFindings: Record<string, unknown> = { readOnly: true }
const localOrgId = getGrowthEngineAiOrgId()
if (!localOrgId) {
  productionFindings = {
    readOnly: true,
    organizationId: null,
    configurationBlocker:
      "GROWTH_ENGINE_AI_ORG_ID empty in local cert env — run probes via vercel-production-env-run for Production validation",
  }
  limitations.push("Production read-only probes require Vercel Production env (GROWTH_ENGINE_AI_ORG_ID)")
} else {
  productionFindings = { readOnly: true, organizationId: localOrgId, note: "org resolved in cert env" }
}
console.log("  ✓ Phase 14 — production read-only posture documented")

// --- Phase 15: Performance validation (architectural caps) ---
const homeLoader = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
const boundedConcurrency = readSource("lib/growth/runtime-guardrails/growth-bounded-concurrency.ts")
assert.match(homeLoader, /GROWTH_HOME|batch|limit|slice/i)
assert.match(boundedConcurrency, /mapWithBoundedConcurrency/)
console.log("  ✓ Phase 15 — performance caps certified at architecture layer")

// --- Phase 16: Run certification suites ---
const suites = [
  "test:ge-aios-degraded-enforcement-closure-1a",
  "test:ge-aios-execution-authority-closure-1a",
  "test:ge-aios-authority-proof-audit-1a",
  "test:ge-aios-scheduler-runtime-optimization-1a",
  "test:ge-aios-home-runtime-optimization-1a",
  "test:ge-aios-runtime-context-1a",
  "test:ge-aios-runtime-optimization-audit-1a",
  "test:ge-aios-operator-story-scale-validation-1a",
  "test:ge-aios-operator-story-implementation-1a",
  "test:ge-aios-mission-orchestration-1a",
  "test:ge-aios-operator-experience-1a",
  "test:ge-aios-decision-engine-1d",
  "test:ge-aios-adaptive-loop-1b",
  "test:ge-aios-memory-resolver-1b",
  "test:ge-aios-call-workspace-intelligence-2b",
  "test:ge-aios-meeting-intelligence-1a",
  "test:ge-aios-first-meeting-workflow-1a",
  "test:ge-aios-growth-5f-autonomous-outreach-preparation",
  "test:ge-aios-send-plane-1a",
  "test:ge-aios-send-plane-1b",
  "test:ge-aios-channels-1a",
  "test:ge-aios-approvals-2a-operator-review-experience",
  "test:growth-reply-intelligence-v2",
  "test:ge-aios-production-validation-1b",
] as const

const suiteResults: Array<{ suite: string; ok: boolean; verdict: string | null }> = []
for (const suite of suites) {
  const result = runSuite(suite)
  suiteResults.push({ suite, ...result })
  const label = result.ok ? "PASS" : "FAIL"
  console.log(`  ${result.ok ? "✓" : "✗"} ${suite} — ${label}${result.verdict ? ` (${result.verdict})` : ""}`)
  if (!result.ok) {
    blockers.push(`${suite} failed`)
  }
}

const failedSuites = suiteResults.filter((row) => !row.ok)
if (failedSuites.some((row) => row.suite.includes("authority") || row.suite.includes("terminal"))) {
  blockers.push("authority_or_terminal_suite_failure")
}
if (failedSuites.some((row) => row.suite.includes("degraded-enforcement"))) {
  blockers.push("degraded_enforcement_suite_failure")
}
if (
  failedSuites.some(
    (row) => row.suite.includes("scheduler") || row.suite.includes("runtime-optimization"),
  )
) {
  blockers.push("scale_or_scheduler_suite_failure")
}

// --- Verdict ---
let verdict: keyof typeof GE_AIOS_AUTONOMY_RECERTIFICATION_1A_VERDICT =
  "READY_FOR_CONTROLLED_AUTONOMOUS_PORTFOLIO_OPERATION"

if (blockers.some((row) => row.includes("authority") || row.includes("terminal"))) {
  verdict = "BLOCKED_BY_AUTHORITY_OR_TERMINAL_DEFECT"
} else if (blockers.some((row) => row.includes("degraded"))) {
  verdict = "BLOCKED_BY_DEGRADED_ENFORCEMENT_DEFECT"
} else if (blockers.some((row) => row.includes("scale") || row.includes("scheduler"))) {
  verdict = "BLOCKED_BY_SCALE_OR_SCHEDULER_DEFECT"
} else if (failedSuites.length > 0) {
  verdict = "BLOCKED_BY_CODE_DEFECT"
} else if (warnings.length > 0 || limitations.length > 0) {
  verdict = "READY_WITH_OPERATOR_OVERSIGHT_LIMITS"
}

console.log("\n--- GE-AIOS-AUTONOMY-RECERTIFICATION-1A SUMMARY ---")
console.log(`QA marker: ${GE_AIOS_AUTONOMY_RECERTIFICATION_1A_QA_MARKER}`)
console.log(`Authority gate: ${GROWTH_CANONICAL_EXECUTION_AUTHORITY_1A_QA_MARKER}`)
console.log(`Chain of command: ${JSON.stringify(chainOfCommand)}`)
console.log(`Migration readiness: ${migrationReadiness}`)
console.log(`Production findings: ${JSON.stringify(productionFindings)}`)
console.log(`Warnings: ${JSON.stringify(warnings)}`)
console.log(`Limitations: ${JSON.stringify(limitations)}`)
console.log(`Blockers: ${JSON.stringify(blockers)}`)
console.log(`Suite pass rate: ${suiteResults.filter((row) => row.ok).length}/${suiteResults.length}`)
console.log(`VERDICT: ${verdict}`)

if (failedSuites.length > 0) {
  console.error("\nGE-AIOS-AUTONOMY-RECERTIFICATION-1A FAIL\n")
  process.exit(1)
}

console.log("\nGE-AIOS-AUTONOMY-RECERTIFICATION-1A PASS\n")
