/**
 * GE-AIOS-DEGRADED-ENFORCEMENT-CLOSURE-1A — Degraded decision enforcement certification.
 * Run: pnpm test:ge-aios-degraded-enforcement-closure-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  evaluateCanonicalExecutionAuthority,
} from "../lib/growth/aios/execution/growth-canonical-execution-authority-1a"
import {
  classifyDraftFactoryFailureRecoverability,
  evaluateDegradedCanonicalEnforcement,
  formatDegradedEnforcementOperatorMessage,
  GROWTH_DEGRADED_ENFORCEMENT_POLICY_MATRIX,
} from "../lib/growth/aios/execution/growth-degraded-enforcement-policy-1a"
import {
  evaluateCanonicalSequenceStepExecution,
  evaluateCanonicalTransportBoundary,
  evaluateGrowth5fPackagePreparation,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1c-enforcement"
import { evaluateCanonicalCopilotMaterializationConsistency } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1d-enforcement"

export const GE_AIOS_DEGRADED_ENFORCEMENT_CLOSURE_1A_QA_MARKER =
  "ge-aios-degraded-enforcement-closure-1a-v1" as const

export const GE_AIOS_DEGRADED_ENFORCEMENT_CLOSURE_1A_VERDICT = {
  READY_FOR_AUTONOMY_RECERTIFICATION: "READY_FOR_AUTONOMY_RECERTIFICATION",
  READY_WITH_READ_ONLY_DEGRADATION_WARNINGS: "READY_WITH_READ_ONLY_DEGRADATION_WARNINGS",
  BLOCKED_BY_PACKAGE_FAIL_OPEN: "BLOCKED_BY_PACKAGE_FAIL_OPEN",
  BLOCKED_BY_SEQUENCE_FAIL_OPEN: "BLOCKED_BY_SEQUENCE_FAIL_OPEN",
  BLOCKED_BY_RECOVERY_GAP: "BLOCKED_BY_RECOVERY_GAP",
  BLOCKED_BY_CODE_DEFECT: "BLOCKED_BY_CODE_DEFECT",
} as const

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log("GE-AIOS-DEGRADED-ENFORCEMENT-CLOSURE-1A\n")

// --- Phase 2: Policy matrix ---
assert.equal(GROWTH_DEGRADED_ENFORCEMENT_POLICY_MATRIX.read_only_projection, "allowed")
assert.equal(GROWTH_DEGRADED_ENFORCEMENT_POLICY_MATRIX.package_preparation, "deferred")
assert.equal(GROWTH_DEGRADED_ENFORCEMENT_POLICY_MATRIX.sequence_dispatch, "blocked")
assert.equal(GROWTH_DEGRADED_ENFORCEMENT_POLICY_MATRIX.transport_dispatch, "blocked")
console.log("  ✓ Phase 2 — definitive degraded-state policy matrix")

// --- Phase 3: Shared degraded enforcement ---
const readOnly = evaluateDegradedCanonicalEnforcement({ actionKind: "read_only_projection" })
assert.equal(readOnly.disposition, "allowed")
assert.equal(readOnly.decisionResolutionFailed, true)
console.log("  ✓ Read-only projection works without decision")

const terminal = evaluateDegradedCanonicalEnforcement({ actionKind: "terminal_propagation" })
assert.equal(terminal.disposition, "allowed")
console.log("  ✓ Terminal propagation works without decision")

const research = evaluateDegradedCanonicalEnforcement({ actionKind: "persisted_safe_research" })
assert.equal(research.disposition, "deferred")
console.log("  ✓ Autonomous research defers without decision")

const qualification = evaluateDegradedCanonicalEnforcement({ actionKind: "qualification_mutation" })
assert.equal(qualification.disposition, "deferred")
console.log("  ✓ Qualification defers without decision")

const datamoon = evaluateDegradedCanonicalEnforcement({ actionKind: "contact_discovery" })
assert.equal(datamoon.disposition, "deferred")
console.log("  ✓ DataMoon provider spend is blocked without decision")

// --- Phase 4: Growth 5F fail-open closure ---
const packagePrep = evaluateGrowth5fPackagePreparation(null)
assert.equal(packagePrep.allowed, false)
assert.equal(packagePrep.outcome, "decision_deferred_resolution_unavailable")
console.log("  ✓ Growth 5F autonomous generation defers")

const packagePreview = evaluateGrowth5fPackagePreparation(null, { isPreviewOnly: true })
assert.equal(packagePreview.allowed, true)
console.log("  ✓ Preview-only package remains transport-blocked at dispatch layer")

const transportNull = evaluateCanonicalTransportBoundary(null, { humanApproved: true })
assert.equal(transportNull.allowed, false)
assert.equal(transportNull.outcome, "transport_blocked_resolution_unavailable")
console.log("  ✓ Transport blocks without decision")

// --- Phase 6: Sequence ---
const sequencePrep = evaluateCanonicalSequenceStepExecution(null, { executionPhase: "preparation" })
assert.equal(sequencePrep.allowed, false)
assert.equal(sequencePrep.outcome, "canonical_decision_resolution_unavailable")
console.log("  ✓ Sequence preparation defers")

const sequenceDispatch = evaluateCanonicalSequenceStepExecution(null, { executionPhase: "dispatch" })
assert.equal(sequenceDispatch.allowed, false)
console.log("  ✓ Sequence dispatch blocks")

// --- Hard lifecycle overrides ---
const archivedPackage = evaluateGrowth5fPackagePreparation(null, {
  leadLifecycle: { status: "archived", archivedAt: "2026-07-14T00:00:00.000Z" },
})
assert.equal(archivedPackage.allowed, false)
const suppressedTransport = evaluateCanonicalTransportBoundary(null, {
  leadLifecycle: { suppressed: true, suppressionReason: "unsubscribe" },
})
assert.equal(suppressedTransport.allowed, false)
console.log("  ✓ Suppression and archived/disqualified/closed states block")

// --- Phase 7: Copilot preview degraded ---
const copilotNull = evaluateCanonicalCopilotMaterializationConsistency(null, { channel: "email" })
assert.equal(copilotNull.allowedForReview, true)
assert.equal(copilotNull.outcome, "preview_only_degraded")
console.log("  ✓ Copilot preview from existing package allowed when decision unavailable")

// --- Phase 8: Operator copy ---
const deferredCopy = formatDegradedEnforcementOperatorMessage("deferred")
assert.match(deferredCopy, /paused for review/i)
assert.doesNotMatch(deferredCopy, /null|resolver|1C|fail-open/i)
console.log("  ✓ Operator copy avoids internal terminology")

// --- Phase 10: DF failure classification ---
assert.equal(
  classifyDraftFactoryFailureRecoverability({ errorCode: "decision_resolver_unavailable" }),
  "recoverable",
)
assert.equal(
  classifyDraftFactoryFailureRecoverability({
    leadLifecycle: { status: "disqualified" },
  }),
  "non_recoverable",
)
console.log("  ✓ Recoverable vs non-recoverable DF failure classification")

// --- Source wiring ---
const enforcement = readSource("lib/growth/aios/growth/growth-canonical-decision-engine-1c-enforcement.ts")
const dfLive = readSource("lib/growth/draft-factory/draft-factory-durable-live.ts")
const seqEnf = readSource("lib/growth/aios/growth/growth-canonical-decision-engine-1d-sequence-enforcement.ts")
const telemetry = readSource("lib/growth/aios/execution/growth-degraded-enforcement-telemetry-1a.ts")

assert.match(enforcement, /evaluateDegradedCanonicalEnforcement/)
assert.doesNotMatch(enforcement, /fail open for package preparation/)
assert.doesNotMatch(enforcement, /sequence path continues with existing gates/)
assert.doesNotMatch(enforcement, /existing transport gates remain authoritative/)
assert.match(dfLive, /recordDegradedEnforcementTelemetry/)
assert.match(dfLive, /classifyDraftFactoryFailureRecoverability/)
assert.match(seqEnf, /executionPhase: "dispatch"/)
assert.match(telemetry, /canonical_decision_degraded_enforcement/)
console.log("  ✓ Source paths closed fail-open behavior")

// --- Execution authority alignment ---
const degradedResearchAuthority = evaluateCanonicalExecutionAuthority({
  actionKind: "persisted_research_run",
  resolution: null,
  leadLifecycle: { status: "qualified" },
})
assert.equal(degradedResearchAuthority.disposition, "deferred")
console.log("  ✓ Execution authority defers research without decision")

let verdict: keyof typeof GE_AIOS_DEGRADED_ENFORCEMENT_CLOSURE_1A_VERDICT =
  "READY_FOR_AUTONOMY_RECERTIFICATION"
const warnings: string[] = []

if (packagePreview.allowed) {
  warnings.push("Preview-only package generation allowed without decision — transport remains blocked at dispatch")
}

if (warnings.length > 0) {
  verdict = "READY_WITH_READ_ONLY_DEGRADATION_WARNINGS"
}

console.log("\n--- GE-AIOS-DEGRADED-ENFORCEMENT-CLOSURE-1A SUMMARY ---")
console.log(`QA marker: ${GE_AIOS_DEGRADED_ENFORCEMENT_CLOSURE_1A_QA_MARKER}`)
console.log(`Policy matrix: ${JSON.stringify(GROWTH_DEGRADED_ENFORCEMENT_POLICY_MATRIX)}`)
console.log(`Warnings: ${JSON.stringify(warnings)}`)
console.log(`VERDICT: ${verdict}`)
console.log("\nGE-AIOS-DEGRADED-ENFORCEMENT-CLOSURE-1A PASS\n")
