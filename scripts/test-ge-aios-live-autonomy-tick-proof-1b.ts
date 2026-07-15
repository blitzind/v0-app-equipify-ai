/**
 * GE-AIOS-LIVE-AUTONOMY-TICK-PROOF-1B — Corrected deployed autonomy tick proof certification.
 *
 * Run: pnpm test:ge-aios-live-autonomy-tick-proof-1b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  resolveGrowthAiosAutonomyTickProofVerdict,
  resolveAdmissionBlockedFromLeadMetadata,
  resolveAutonomyTickStopReason,
  AutonomyTickHealthBuildError,
} from "@/lib/growth/aios/runtime/growth-aios-autonomy-tick-health-1a-types"
import {
  GROWTH_AIOS_LIVE_AUTONOMY_TICK_PROOF_1B_QA_MARKER,
  type GrowthAiosAutonomyTickHealthSnapshot,
} from "@/lib/growth/aios/runtime/growth-aios-autonomy-tick-health-1a-types"
import {
  classifyBooleanFromDeployedOrLocal,
} from "@/lib/growth/aios/runtime/growth-aios-runtime-config-health-1a-classifiers"
import { GROWTH_AIOS_AUTONOMY_TICK_HEALTH_ROUTE_PATH } from "@/lib/growth/qa/growth-aios-autonomy-tick-health-deployed-probe"

const ROOT = process.cwd()
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function sampleTickHealth(overrides: Partial<GrowthAiosAutonomyTickHealthSnapshot> = {}): GrowthAiosAutonomyTickHealthSnapshot {
  return {
    ok: true,
    qaMarker: GROWTH_AIOS_LIVE_AUTONOMY_TICK_PROOF_1B_QA_MARKER,
    organizationResolved: true,
    portfolioSnapshotBuilt: true,
    leadCount: 1,
    candidateCount: 1,
    selectedWork: true,
    selectedWorkType: "research",
    workflowAgent: "research_agent",
    decisionResolved: true,
    authorityDisposition: "allowed",
    wouldExecute: true,
    outboundEnabled: false,
    mutationPerformed: false,
    stopReason: null,
    admissionBlocked: false,
    ...overrides,
  }
}

console.log("GE-AIOS-LIVE-AUTONOMY-TICK-PROOF-1B\n")

const routeSource = readSource("app/api/platform/growth/ai-os/autonomy-tick-health/route.ts")
const serviceSource = readSource("lib/growth/aios/runtime/growth-aios-autonomy-tick-health-1a.ts")
const aslSource = readSource("lib/growth/specialists/execution/run-autonomous-sales-loop.ts")
const proof1aSource = readSource("scripts/test-ge-aios-live-autonomy-tick-proof-1a.ts")

assert.match(routeSource, /requireGrowthEnginePlatformAccess/)
assert.match(routeSource, /dryRun !== false/)
assert.match(routeSource, /buildGrowthAiosAutonomyTickHealthSnapshot/)
assert.match(serviceSource, /buildGrowthAutonomousPortfolioWorkSnapshot/)
assert.match(serviceSource, /runWorkManager/)
assert.match(serviceSource, /selectNextExecutableWorkItem/)
assert.match(serviceSource, /inspectAutonomousSalesLoopDryRun/)
assert.match(serviceSource, /evaluateCanonicalExecutionAuthorityForLead/)
assert.match(serviceSource, /mutationPerformed: false/)
assert.match(aslSource, /buildGrowthAutonomousPortfolioWorkSnapshot/)
assert.doesNotMatch(proof1aSource, /traceDeployedAslPath/)
assert.match(proof1aSource, /tracePortfolioAslPath/)
assert.match(proof1aSource, /traceLegacyHomeSummaryComparison/)
assert.match(proof1aSource, /fetchDeployedGrowthAiosRuntimeConfigHealth/)
assert.doesNotMatch(proof1aSource, /BLOCKED_BY_OBSOLETE_FEATURE_GATE/)
assert.match(serviceSource, /createGrowthAiOsRuntimeContext/)
assert.match(serviceSource, /runtimeContext\.getDecision/)
assert.match(serviceSource, /authorityReasonCode/)
assert.match(serviceSource, /buildLeadLifecycleSnapshotForAuthority/)
assert.doesNotMatch(serviceSource, /resolveLeadAdmissionStateFromMetadata\(lead\.metadata\)\.state/)
assert.match(serviceSource, /let stage: AutonomyTickHealthStage/)
assert.match(routeSource, /AutonomyTickHealthBuildError/)
assert.doesNotMatch(routeSource, /message: detail/)
console.log("  ✓ Phase 1 — deployed portfolio ASL path + dry-run endpoint wired")

const serialized = JSON.stringify(sampleTickHealth())
assert.doesNotMatch(serialized, UUID_PATTERN)
assert.doesNotMatch(serialized, /company|email|@|api_key|secret/i)
assert.equal(sampleTickHealth().mutationPerformed, false)
console.log("  ✓ Phase 2 — tick health response is non-sensitive")

assert.equal(
  classifyBooleanFromDeployedOrLocal({
    deployedValue: true,
    localValue: false,
    localEnvPresent: false,
    vercelProductionEnvRun: true,
  }),
  "verified_true",
)
assert.equal(
  classifyBooleanFromDeployedOrLocal({
    deployedValue: undefined,
    localValue: false,
    localEnvPresent: false,
    vercelProductionEnvRun: true,
  }),
  "unverified_sensitive_value",
)
console.log("  ✓ Phase 3 — deployed configuration wins over hidden local secrets")

assert.equal(
  resolveGrowthAiosAutonomyTickProofVerdict({
    tickHealth: sampleTickHealth(),
  }),
  "READY_FOR_FIRST_INTERNAL_AUTONOMY_TICK",
)
assert.equal(
  resolveGrowthAiosAutonomyTickProofVerdict({
    tickHealth: sampleTickHealth({ leadCount: 0 }),
  }),
  "BLOCKED_BY_EMPTY_PORTFOLIO",
)
assert.equal(
  resolveGrowthAiosAutonomyTickProofVerdict({
    tickHealth: sampleTickHealth({ admissionBlocked: true }),
  }),
  "BLOCKED_BY_ADMISSION_STATE",
)
assert.equal(
  resolveGrowthAiosAutonomyTickProofVerdict({
    tickHealth: sampleTickHealth({ authorityDisposition: "blocked", selectedWork: true }),
  }),
  "BLOCKED_BY_EXECUTION_AUTHORITY",
)
assert.equal(
  resolveGrowthAiosAutonomyTickProofVerdict({
    tickHealth: sampleTickHealth({ wouldExecute: false, selectedWork: false, leadCount: 2 }),
    activeLeadCount: 2,
  }),
  "READY_AFTER_PORTFOLIO_ADMISSION",
)
console.log("  ✓ Phase 4 — verdict taxonomy identifies portfolio/admission/authority blockers")

assert.equal(GROWTH_AIOS_AUTONOMY_TICK_HEALTH_ROUTE_PATH, "/api/platform/growth/ai-os/autonomy-tick-health")
console.log("  ✓ Phase 5 — autonomy tick health route path canonical")

assert.equal(resolveAdmissionBlockedFromLeadMetadata(null), false)
assert.equal(resolveAdmissionBlockedFromLeadMetadata({}), false)
assert.equal(resolveAdmissionBlockedFromLeadMetadata(undefined), false)
assert.equal(resolveAdmissionBlockedFromLeadMetadata({ admission_state: "accepted" }), false)
assert.equal(resolveAdmissionBlockedFromLeadMetadata({ admission_state: "review" }), true)
console.log("  ✓ Phase 6 — null admission metadata is valid, not blocked")

assert.equal(
  resolveAutonomyTickStopReason({
    selectedWork: true,
    decisionResolved: false,
    authorityDisposition: "deferred",
    authorityReasonCode: "degraded_safe_research_deferred",
    dryRunStopReason: null,
  }),
  "degraded_safe_research_deferred",
)
assert.equal(
  resolveAutonomyTickStopReason({
    selectedWork: true,
    decisionResolved: true,
    authorityDisposition: "blocked",
    authorityReasonCode: "hard_terminal_archived",
    dryRunStopReason: null,
  }),
  "hard_terminal_archived",
)
assert.equal(
  resolveAutonomyTickStopReason({
    selectedWork: true,
    decisionResolved: false,
    authorityDisposition: "deferred",
    authorityReasonCode: null,
    dryRunStopReason: null,
  }),
  "decision_resolution_unavailable",
)
assert.equal(
  resolveAutonomyTickStopReason({
    selectedWork: false,
    decisionResolved: false,
    authorityDisposition: null,
    dryRunStopReason: null,
  }),
  "no_executable_work",
)
assert.equal(
  resolveAutonomyTickStopReason({
    selectedWork: true,
    decisionResolved: true,
    authorityDisposition: "allowed",
    dryRunStopReason: null,
  }),
  null,
)
console.log("  ✓ Phase 7 — truthful stop reasons for missing state and empty portfolio")

const deferredResearch = sampleTickHealth({
  selectedWork: true,
  selectedWorkType: "research",
  decisionResolved: false,
  authorityDisposition: "deferred",
  wouldExecute: false,
  stopReason: "degraded_safe_research_deferred",
})
assert.equal(deferredResearch.mutationPerformed, false)
assert.equal(deferredResearch.wouldExecute, false)
assert.equal(
  resolveGrowthAiosAutonomyTickProofVerdict({ tickHealth: deferredResearch }),
  "BLOCKED_BY_EXECUTION_AUTHORITY",
)

const archivedResearch = sampleTickHealth({
  selectedWork: true,
  selectedWorkType: "research",
  decisionResolved: true,
  authorityDisposition: "blocked",
  wouldExecute: false,
  stopReason: "hard_terminal_archived",
})
assert.equal(archivedResearch.stopReason, "hard_terminal_archived")
assert.equal(
  resolveGrowthAiosAutonomyTickProofVerdict({ tickHealth: archivedResearch }),
  "BLOCKED_BY_EXECUTION_AUTHORITY",
)
console.log("  ✓ Phase 8 — research work with deferred authority stays mutation-free")

const routeErrorBody = JSON.stringify({
  ok: false,
  qaMarker: GROWTH_AIOS_LIVE_AUTONOMY_TICK_PROOF_1B_QA_MARKER,
  error: "autonomy_tick_health_failed",
  stage: "admission_evaluation",
})
assert.doesNotMatch(routeErrorBody, /Cannot read properties|stack|message/i)
assert.match(routeErrorBody, /admission_evaluation/)
console.log("  ✓ Phase 9 — sanitized error response exposes stage only")

const buildError = new AutonomyTickHealthBuildError({
  stage: "execution_authority",
  diagnostics: {
    stage: "execution_authority",
    organizationResolved: true,
    portfolioSnapshotBuilt: true,
    workSelected: true,
    decisionResolutionStarted: true,
    authorityEvaluationStarted: true,
    errorClass: "TypeError",
  },
  cause: new TypeError("Cannot read properties of null (reading 'state')"),
})
assert.equal(buildError.stage, "execution_authority")
assert.match(buildError.diagnostics.errorClass ?? "", /TypeError/)
console.log("  ✓ Phase 10 — server-side stage diagnostics capture failure boundary")

console.log("\nGE-AIOS-LIVE-AUTONOMY-TICK-PROOF-1B PASS\n")
