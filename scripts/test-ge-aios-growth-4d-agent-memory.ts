/**
 * GE-AIOS-GROWTH-4D — Agent Memory & Shared Context certification.
 * Run: pnpm test:ge-aios-growth-4d-agent-memory
 */
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AGENT_MEMORY_QA_MARKER,
  GROWTH_AGENT_MEMORY_RULE,
  GROWTH_AGENT_MEMORY_COMPLETENESS_STATES,
} from "../lib/growth/aios/growth/growth-agent-memory-types"
import {
  buildAgentContextView,
  buildAgentMemoryLeadBundle,
  buildAgentMemoryPlanContext,
  buildAgentMemoryReadModel,
  buildSharedAgentMemoryRecord,
  detectMemoryConflicts,
  isAgentMemorySchedulerActive,
  scoreMemoryCompleteness,
} from "../lib/growth/aios/growth/growth-agent-memory-engine"
import { GROWTH_AGENT_KINDS } from "../lib/growth/aios/growth/growth-agent-framework-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoForbiddenPaths(relativePath: string): void {
  const source = readSource(relativePath)
  for (const token of [
    "createAiWorkOrder",
    "invokeAiOsProvider",
    "sendEmail",
    "sendSms",
    "executeTransportSend",
    "cron.schedule",
    "setInterval",
    "enqueueRuntime",
    "startWorkflow",
  ]) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

function baseAggregation(
  overrides: Partial<Parameters<typeof buildSharedAgentMemoryRecord>[0]> = {},
) {
  return {
    leadId: "lead-cert-4d",
    companyName: "Cert Co",
    companySummary: "Cert company summary",
    researchSummary: "Research complete",
    qualificationSummary: "Fit 82 — qualified",
    opportunityAssessment: "High fit opportunity",
    nextBestAction: "Verify email",
    executionPlanSummary: "research company · ready · outcome",
    workflowType: "research_company" as const,
    approvalState: "approved_for_future_execution",
    readinessState: "ready_for_future_execution",
    handoffState: "handoff_ready",
    boundaryStatus: "boundary_clear",
    preflightStatus: "preflight_ready",
    simulationSummary: "Simulation passed",
    runtimeState: null,
    dryRunState: "dry_run_passed",
    pilotState: "Pilot eligible",
    owningAgent: "execution_agent" as const,
    routedEvents: ["execution plan approved"],
    revenueOperatorRecommendation: "Hand off to Execution Agent",
    blockedReasons: [],
    humanReviewRequirements: [],
    confidence: 0.82,
    lastUpdatedAt: "2026-06-25T00:00:00.000Z",
    generatedAt: "2026-06-25T00:00:00.000Z",
    futureExecutionEligible: true,
    pilotEligible: true,
    pilotBlockedReasons: [],
    orchestrationDecision: "handoff_to_execution",
    preflightMissingRequirements: [],
    coreTouchRiskPresent: false,
    outboundRecommended: false,
    workflowStatus: "assessed",
    ...overrides,
  }
}

console.log("[GE-AIOS-GROWTH-4D] Agent Memory & Shared Context certification")

assert.equal(GROWTH_AGENT_MEMORY_QA_MARKER, "growth-aios-growth-4d-agent-memory-v1")
assert.match(GROWTH_AGENT_MEMORY_RULE, /read-only aggregation|without writing memory/i)
assert.equal(GROWTH_AGENT_MEMORY_COMPLETENESS_STATES.length, 8)
console.log("  ✓ QA marker and completeness states")

assertNoForbiddenPaths("lib/growth/aios/growth/growth-agent-memory-types.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-agent-memory-engine.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-agent-memory-service.ts")
console.log("  ✓ No forbidden side-effect tokens")

const commandCenterUi = readSource(
  "components/growth/ai-os/command-center/growth-ai-os-agent-memory-section.tsx",
)
assert.match(commandCenterUi, /Agent Memory/)
assert.equal(commandCenterUi.toLowerCase().includes("run agent"), false)
console.log("  ✓ Command Center Agent Memory section — no run controls")

const missionPlanning = readSource("lib/growth/aios/ai-executive-mission-planning-review-service.ts")
assert.match(missionPlanning, /buildGrowthAgentMemoryPlanContext/)
assert.match(missionPlanning, /agentMemoryContext/)

const missionPlanningUi = readSource(
  "components/growth/ai-os/growth/growth-ai-os-lead-research-execution-plan-section.tsx",
)
assert.match(missionPlanningUi, /agent-memory-context/)
console.log("  ✓ Mission Planning Review agent memory context")

const complete = scoreMemoryCompleteness(baseAggregation())
assert.equal(complete.completenessState, "complete")
console.log("  ✓ Complete shared memory scoring")

const missingResearch = scoreMemoryCompleteness(
  baseAggregation({ researchSummary: null, workflowStatus: "not_started" }),
)
assert.equal(missingResearch.completenessState, "missing_research")
console.log("  ✓ Missing research detected")

const missingApproval = scoreMemoryCompleteness(
  baseAggregation({ approvalState: "pending_review" }),
)
assert.equal(missingApproval.completenessState, "missing_approval")
console.log("  ✓ Missing approval detected")

const conflicts = detectMemoryConflicts(
  baseAggregation({
    approvalState: "approved_for_future_execution",
    readinessState: "blocked_missing_prerequisites",
    futureExecutionEligible: true,
    dryRunState: "not_run",
    orchestrationDecision: "handoff_to_execution",
    pilotEligible: false,
    pilotBlockedReasons: ["Pilot flag off"],
    handoffState: "handoff_ready",
    preflightStatus: "preflight_blocked",
    preflightMissingRequirements: ["Dry-run required"],
    workflowType: "outreach_generation",
    outboundRecommended: true,
    coreTouchRiskPresent: true,
  }),
)
const coreConflict = detectMemoryConflicts(
  baseAggregation({
    approvalState: "pending_review",
    coreTouchRiskPresent: true,
  }),
)
assert.ok(conflicts.some((c) => c.kind === "approved_but_readiness_blocked"))
assert.ok(conflicts.some((c) => c.kind === "handoff_ready_but_preflight_blocked"))
assert.ok(conflicts.some((c) => c.kind === "runtime_eligible_but_dry_run_missing"))
assert.ok(conflicts.some((c) => c.kind === "execution_recommended_but_pilot_blocked"))
assert.ok(conflicts.some((c) => c.kind === "outbound_recommended_while_outreach_blocked"))
assert.ok(coreConflict.some((c) => c.kind === "core_mutation_risk_without_approval"))
console.log("  ✓ Conflict detection")

const memory = buildSharedAgentMemoryRecord(baseAggregation())
const snapshot = JSON.stringify(memory)
const snapshot2 = JSON.stringify(buildSharedAgentMemoryRecord(baseAggregation()))
assert.equal(snapshot, snapshot2, "Shared memory must be deterministic")
console.log("  ✓ Deterministic shared memory")

const bundle = buildAgentMemoryLeadBundle(baseAggregation())
assert.equal(bundle.agentViews.length, GROWTH_AGENT_KINDS.length)
for (const kind of GROWTH_AGENT_KINDS) {
  const view = buildAgentContextView(kind, bundle.sharedMemory)
  assert.equal(view.agentKind, kind)
  assert.ok(view.whatToKnow.length > 0)
}
console.log("  ✓ All agent views derive from same shared memory")

const planContext = buildAgentMemoryPlanContext(bundle)
assert.ok(planContext)
assert.equal(planContext?.completenessState, "complete")
console.log("  ✓ Mission planning memory context")

const readModel = buildAgentMemoryReadModel({
  generatedAt: "2026-06-25T00:00:00.000Z",
  bundles: [bundle],
})
assert.equal(readModel.summary.leadsIndexed, 1)
console.log("  ✓ Read model aggregation")

assert.equal(isAgentMemorySchedulerActive(), false)
console.log("  ✓ Scheduler inactive")

console.log("[GE-AIOS-GROWTH-4D] Running 4C regression…")
const result = spawnSync("pnpm", ["test:ge-aios-growth-4c-agent-events"], {
  stdio: "inherit",
  shell: true,
})
assert.equal(result.status, 0, "4C regression failed")

console.log("[GE-AIOS-GROWTH-4D] PASS — Agent Memory & Shared Context certified")
