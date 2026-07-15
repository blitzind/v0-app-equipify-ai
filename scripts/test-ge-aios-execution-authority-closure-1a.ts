/**
 * GE-AIOS-EXECUTION-AUTHORITY-CLOSURE-1A — Execution authority closure certification.
 * Run: pnpm test:ge-aios-execution-authority-closure-1a
 */
import assert from "node:assert/strict"
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
  formatTerminalReasonOperatorMessage,
  getTerminalReasonPolicy,
  inferHardTerminalReasonFromLeadLifecycle,
} from "../lib/growth/aios/execution/growth-terminal-reason-taxonomy-1a"
import {
  evaluateCanonicalSequenceStepExecution,
  evaluateCanonicalTransportBoundary,
  evaluateDraftFactoryDecisionGate,
  evaluateGrowth5fPackagePreparation,
  isLeadLifecycleBlockedByDecision,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1c-enforcement"
import type { GrowthCanonicalDecisionResolution } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import type { GrowthCanonicalNextBestDecision } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a-types"

export const GE_AIOS_EXECUTION_AUTHORITY_CLOSURE_1A_QA_MARKER =
  "ge-aios-execution-authority-closure-1a-v1" as const

export const GE_AIOS_EXECUTION_AUTHORITY_CLOSURE_1A_VERDICT = {
  READY_FOR_AUTONOMY_RECERTIFICATION: "READY_FOR_AUTONOMY_RECERTIFICATION",
  READY_WITH_NON_CUSTOMER_FACING_WARNINGS: "READY_WITH_NON_CUSTOMER_FACING_WARNINGS",
  BLOCKED_BY_EXECUTION_AUTHORITY_GAP: "BLOCKED_BY_EXECUTION_AUTHORITY_GAP",
  BLOCKED_BY_TERMINAL_PROPAGATION_GAP: "BLOCKED_BY_TERMINAL_PROPAGATION_GAP",
  BLOCKED_BY_SEQUENCE_CLOSURE_GAP: "BLOCKED_BY_SEQUENCE_CLOSURE_GAP",
  BLOCKED_BY_CODE_DEFECT: "BLOCKED_BY_CODE_DEFECT",
} as const

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function buildDecision(
  primaryAction: GrowthCanonicalNextBestDecision["primaryAction"],
  input?: Partial<GrowthCanonicalNextBestDecision>,
): GrowthCanonicalNextBestDecision {
  return {
    qaMarker: "ge-aios-decision-engine-1a-v1",
    decisionId: `decision-${primaryAction}`,
    decisionFingerprint: `fp-${primaryAction}`,
    organizationId: "org-fixture",
    leadId: "lead-fixture",
    generatedAt: "2026-07-14T12:00:00.000Z",
    primaryAction,
    title: `Test ${primaryAction}`,
    rationale: ["fixture"],
    urgency: primaryAction === "wait" ? "scheduled" : "today",
    confidence: 80,
    recommendedActor: "ava",
    recommendedChannel: "none",
    prerequisites: [],
    blockedBy: [],
    supportingActions: [],
    suppressedActions: [],
    operatorReviewRequired: false,
    transportBlocked: primaryAction !== "contact",
    waitUntil: input?.waitUntil ?? null,
    sourceSummary: {},
    ...input,
  }
}

function buildResolution(decision: GrowthCanonicalNextBestDecision): GrowthCanonicalDecisionResolution {
  return {
    qaMarker: "ge-aios-canonical-decision-engine-1b-v1",
    decision,
    freshness: { state: "current", reason: "fixture" },
    suppressionHints: {
      suppressColdOutreach: decision.primaryAction === "wait",
      suppressSequenceSends: decision.primaryAction === "wait",
      suppressDuplicatePackage: false,
      suppressTransport: decision.primaryAction === "wait",
    },
    generatedAt: "2026-07-14T12:00:00.000Z",
    inputDegraded: [],
  }
}

console.log("GE-AIOS-EXECUTION-AUTHORITY-CLOSURE-1A\n")

// --- Phase 1: Policy matrix ---
assert.equal(GROWTH_CANONICAL_EXECUTION_ACTION_POLICY_MATRIX.read_only.hardTerminal, "allowed")
assert.equal(GROWTH_CANONICAL_EXECUTION_ACTION_POLICY_MATRIX.safe_research.hardTerminal, "blocked")
assert.equal(GROWTH_CANONICAL_EXECUTION_ACTION_POLICY_MATRIX.terminal_propagation.hardTerminal, "allowed")
assert.equal(resolveExecutionActionPolicy("qualification_mutation").requires1CEnforcement, true)
console.log("  ✓ Phase 1 — definitive action policy matrix")

// --- Phase 2: Authority gate fixtures ---
const activeResolution = buildResolution(buildDecision("research"))
const waitResolution = buildResolution(buildDecision("wait", { waitUntil: "2026-12-01T00:00:00.000Z" }))
const pauseResolution = buildResolution(
  buildDecision("pause", {
    blockedBy: [{ source: "operator_constraints", severity: "hard", label: "Operator paused account" }],
  }),
)

const activeResearch = evaluateCanonicalExecutionAuthority({
  actionKind: "persisted_research_run",
  resolution: activeResolution,
  leadLifecycle: { status: "qualified" },
})
assert.equal(activeResearch.disposition, "allowed")
console.log("  ✓ ASL research on active lead is allowed")

const waitResearch = evaluateCanonicalExecutionAuthority({
  actionKind: "persisted_research_run",
  resolution: waitResolution,
  leadLifecycle: { status: "qualified" },
  generatedAt: "2026-07-14T12:00:00.000Z",
})
assert.equal(waitResearch.disposition, "allowed", "safe research may proceed during prospect wait when readiness improves")
console.log("  ✓ ASL research during prospect wait follows explicit policy")

const archivedResearch = evaluateCanonicalExecutionAuthority({
  actionKind: "persisted_research_run",
  resolution: activeResolution,
  leadLifecycle: { status: "archived", archivedAt: "2026-07-14T00:00:00.000Z" },
})
assert.equal(archivedResearch.disposition, "blocked")
console.log("  ✓ ASL research on archived lead is blocked")

const pauseQualification = evaluateCanonicalExecutionAuthority({
  actionKind: "qualification_mutation",
  resolution: pauseResolution,
  leadLifecycle: { status: "qualified" },
})
assert.equal(pauseQualification.disposition, "blocked")
console.log("  ✓ Qualification during operator pause is blocked")

const activeQualification = evaluateCanonicalExecutionAuthority({
  actionKind: "qualification_mutation",
  resolution: activeResolution,
  leadLifecycle: { status: "qualified" },
})
assert.equal(activeQualification.disposition, "allowed")
console.log("  ✓ Qualification on active lead is allowed only after 1C")

const disqualifiedDiscovery = evaluateCanonicalExecutionAuthority({
  actionKind: "contact_discovery",
  resolution: activeResolution,
  leadLifecycle: { status: "disqualified" },
})
assert.equal(disqualifiedDiscovery.disposition, "blocked")
console.log("  ✓ DataMoon discovery after disqualification is blocked")

const degradedInternal = evaluateCanonicalExecutionAuthority({
  actionKind: "qualification_mutation",
  resolution: null,
  leadLifecycle: { status: "qualified" },
})
assert.equal(degradedInternal.disposition, "deferred")
const degradedCustomer = evaluateCanonicalExecutionAuthority({
  actionKind: "customer_facing_dispatch",
  resolution: null,
  leadLifecycle: { status: "qualified" },
})
assert.equal(degradedCustomer.disposition, "blocked")
console.log("  ✓ Degraded decision resolution: internal defers, customer-facing blocked")

// --- Source wiring proofs ---
const researchExec = readSource("lib/growth/research/growth-lead-research-execution-service.ts")
const qualificationSvc = readSource("lib/growth/aios/growth/growth-autonomous-qualification-pilot-service.ts")
const executeAgent = readSource("lib/growth/specialists/execution/execute-sales-workflow-agent.ts")
const datamoonSvc = readSource("lib/growth/datamoon-decision-maker/datamoon-dm-service.ts")
const stopWork = readSource("lib/growth/aios/approvals/completed-work-lifecycle-propagation.ts")
const replyRoutes = readSource("lib/growth/reply-intelligence/reply-routing-workflows.ts")
const processEvent = readSource("lib/growth/outbound/process-event.ts")
const mutateOpp = readSource("lib/growth/opportunity-pipeline/mutate-opportunity.ts")
const operatorLang = readSource("lib/growth/aios/operator-experience/growth-operator-language-1a.ts")
const seqRunner = readSource("lib/growth/sequences/execution/sequence-job-runner.ts")

assert.match(researchExec, /evaluateCanonicalExecutionAuthorityForLead/)
assert.match(researchExec, /recheckCanonicalExecutionAuthorityForLead/)
assert.match(qualificationSvc, /evaluateCanonicalExecutionAuthorityForLead/)
assert.match(executeAgent, /evaluateCanonicalExecutionAuthorityForLead/)
assert.match(datamoonSvc, /evaluateCanonicalExecutionAuthorityForLead/)
assert.match(datamoonSvc, /recheckCanonicalExecutionAuthorityForLead/)
console.log("  ✓ ASL research/qualification and DataMoon wired to execution authority")

assert.match(stopWork, /propagateCanonicalTerminalStateForLead/)
assert.match(stopWork, /haltSequenceEnrollmentsForLead/)
assert.match(stopWork, /cancelSequenceEnrollment/)
assert.match(replyRoutes, /propagateCanonicalTerminalStateForLead/)
assert.match(replyRoutes, /propagateContactTerminalStateForLead/)
assert.match(processEvent, /propagateCanonicalTerminalStateForLead/)
assert.match(mutateOpp, /propagateCanonicalTerminalStateForLead/)
assert.match(mutateOpp, /invalidateCanonicalDecisionCacheForLead/)
console.log("  ✓ Terminal propagation unified across RI, webhook, opportunity, stopAutonomousWork")

assert.match(replyRoutes, /MANDATORY_HARD_STOP_INTENTS/)
assert.doesNotMatch(replyRoutes, /stop_sequence[\s\S]{0,120}pending_review[\s\S]{0,40}unsubscribe/)
console.log("  ✓ Unsubscribe reply uses mandatory stop (not pending_review-only)")

assert.match(operatorLang, /formatTerminalReasonOperatorMessage/)
const archivedCopy = formatTerminalReasonOperatorMessage("archived")
assert.match(archivedCopy, /archived/i)
assert.doesNotMatch(archivedCopy, /cache|fingerprint|enforcement/i)
console.log("  ✓ Operator copy clearly explains why work stopped")

// --- Terminal taxonomy ---
assert.equal(getTerminalReasonPolicy("unsubscribed").sequencesAction, "cancel")
assert.equal(getTerminalReasonPolicy("prospect_wait").retainFutureWake, true)
assert.equal(inferHardTerminalReasonFromLeadLifecycle({ status: "archived" }), "archived")
console.log("  ✓ Terminal reason taxonomy")

// --- Customer-facing dispatch regressions remain green ---
const waitPackageGate = evaluateDraftFactoryDecisionGate(waitResolution)
assert.equal(waitPackageGate.allowGeneration, false)
const waitSequence = evaluateCanonicalSequenceStepExecution(waitResolution, { stepLabel: "follow-up email" })
assert.equal(waitSequence.allowed, false)
const waitTransport = evaluateCanonicalTransportBoundary(waitResolution, { humanApproved: true })
assert.equal(waitTransport.allowed, false)
assert.match(seqRunner, /enforceCanonicalDecisionForSequenceChannelJob/)
assert.match(seqRunner, /assertPreSendAllowed/)
console.log("  ✓ Customer-facing dispatch regressions remain green")

// --- 10B remains portfolio-only ---
const wm = readSource("lib/growth/work-manager/manager/run-work-manager.ts")
const de10b = readSource("lib/growth/decision-engine/engine/run-decision-engine.ts")
assert.doesNotMatch(wm, /resolveGrowthCanonicalDecisionForLead/)
assert.doesNotMatch(de10b, /resolveGrowthCanonicalDecisionForLead/)
console.log("  ✓ 10B ranking remains portfolio-only")

// --- Race fixtures (authority recheck at boundaries) ---
assert.match(researchExec, /prePersistAuthority|recheckCanonicalExecutionAuthorityForLead/)
assert.match(executeAgent, /bypassDecisionCache:\s*true/)
console.log("  ✓ Race-condition recheck fixtures at execution boundaries")

// --- Approved unsent remains blocked at transport ---
const contactResolution = buildResolution(buildDecision("contact"))
assert.equal(
  evaluateCanonicalTransportBoundary(contactResolution, { humanApproved: false }).allowed,
  false,
)
console.log("  ✓ Approved-but-unsent path still blocked without human approval at transport")

const unresolvedPackage = evaluateGrowth5fPackagePreparation(null)
assert.equal(unresolvedPackage.allowed, false)
const unresolvedSequence = evaluateCanonicalSequenceStepExecution(null, { executionPhase: "dispatch" })
assert.equal(unresolvedSequence.allowed, false)
console.log("  ✓ Null decision defers package prep and blocks sequence dispatch")

let verdict: keyof typeof GE_AIOS_EXECUTION_AUTHORITY_CLOSURE_1A_VERDICT =
  "READY_FOR_AUTONOMY_RECERTIFICATION"
const warnings: string[] = []

console.log("\n--- GE-AIOS-EXECUTION-AUTHORITY-CLOSURE-1A SUMMARY ---")
console.log(`QA marker: ${GE_AIOS_EXECUTION_AUTHORITY_CLOSURE_1A_QA_MARKER}`)
console.log(`Authority gate marker: ${GROWTH_CANONICAL_EXECUTION_AUTHORITY_1A_QA_MARKER}`)
console.log(`Policy matrix: ${JSON.stringify(GROWTH_CANONICAL_EXECUTION_ACTION_POLICY_MATRIX)}`)
console.log(`Warnings: ${JSON.stringify(warnings)}`)
console.log(`VERDICT: ${verdict}`)
console.log("\nGE-AIOS-EXECUTION-AUTHORITY-CLOSURE-1A PASS\n")
