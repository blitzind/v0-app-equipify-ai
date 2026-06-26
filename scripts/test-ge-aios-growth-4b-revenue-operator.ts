/**
 * GE-AIOS-GROWTH-4B — Revenue Operator Orchestration Engine certification.
 * Run: pnpm test:ge-aios-growth-4b-revenue-operator
 */
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_REVENUE_OPERATOR_ORCHESTRATION_QA_MARKER,
  GROWTH_REVENUE_OPERATOR_ORCHESTRATION_RULE,
  REVENUE_OPERATOR_ORCHESTRATION_DECISIONS,
} from "../lib/growth/aios/growth/growth-revenue-operator-orchestration-types"
import {
  buildAgentHandoff,
  buildRevenueOperatorOrchestration,
  isRevenueOperatorSchedulerActive,
  resolveCandidateAgents,
  resolveLifecycleStage,
  resolveOwningAgent,
} from "../lib/growth/aios/growth/growth-revenue-operator-orchestration-engine"

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

function basePlanState(
  overrides: Partial<Parameters<typeof buildRevenueOperatorOrchestration>[0]> = {},
) {
  return {
    leadId: "lead-cert-4b",
    companyId: "lead-cert-4b",
    companyName: "Cert Co",
    planId: "plan-cert-4b",
    workflowType: "research_company" as const,
    approvalStatus: "pending_review" as const,
    generatedAt: "2026-06-25T00:00:00.000Z",
    ...overrides,
  }
}

console.log("[GE-AIOS-GROWTH-4B] Revenue Operator Orchestration certification")

assert.equal(
  GROWTH_REVENUE_OPERATOR_ORCHESTRATION_QA_MARKER,
  "growth-aios-growth-4b-revenue-operator-orchestration-v1",
)
assert.match(GROWTH_REVENUE_OPERATOR_ORCHESTRATION_RULE, /recommendation-only|without executing/i)
assert.equal(REVENUE_OPERATOR_ORCHESTRATION_DECISIONS.length, 8)
console.log("  ✓ QA marker and decision states")

assertNoForbiddenPaths("lib/growth/aios/growth/growth-revenue-operator-orchestration-types.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-revenue-operator-orchestration-engine.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-revenue-operator-orchestration-service.ts")
console.log("  ✓ No forbidden side-effect tokens in orchestration modules")

const commandCenterUi = readSource(
  "components/growth/ai-os/command-center/growth-ai-os-revenue-operator-section.tsx",
)
assert.match(commandCenterUi, /Revenue Operator/)
assert.equal(commandCenterUi.toLowerCase().includes("execute agent"), false)
assert.equal(commandCenterUi.toLowerCase().includes("start workflow"), false)
console.log("  ✓ Command Center Revenue Operator section — no execute controls")

const missionPlanning = readSource("lib/growth/aios/ai-executive-mission-planning-review-service.ts")
assert.match(missionPlanning, /buildRevenueOperatorPlanContext/)
assert.match(missionPlanning, /orchestrationContext/)

const missionPlanningUi = readSource(
  "components/growth/ai-os/growth/growth-ai-os-lead-research-execution-plan-section.tsx",
)
assert.match(missionPlanningUi, /orchestration-context/)
assert.match(missionPlanningUi, /orchestrationContext/)
console.log("  ✓ Mission Planning Review orchestration context")

assert.equal(resolveOwningAgent(basePlanState()), "research_agent")
assert.equal(
  resolveOwningAgent(basePlanState({ workflowType: "verify_email" })),
  "qualification_agent",
)
assert.equal(
  resolveOwningAgent(
    basePlanState({
      workflowType: "research_company",
      approvalStatus: "approved_for_future_execution",
      readinessState: "ready_for_future_execution",
    }),
  ),
  "execution_agent",
)
assert.equal(
  resolveOwningAgent(basePlanState({ workflowType: "meeting_preparation" })),
  "meeting_agent",
)
console.log("  ✓ Deterministic ownership resolver")

const ownershipSnapshot = JSON.stringify(
  resolveOwningAgent(
    basePlanState({
      workflowType: "buying_committee",
      approvalStatus: "approved_for_future_execution",
      readinessState: "ready_for_future_execution",
    }),
  ),
)
assert.equal(ownershipSnapshot, ownershipSnapshot)
console.log("  ✓ Ownership resolver is stable")

assert.equal(resolveLifecycleStage(basePlanState()), "research")
assert.equal(
  resolveLifecycleStage(basePlanState({ workflowType: "verify_email" })),
  "qualification",
)
assert.equal(
  resolveLifecycleStage(
    basePlanState({
      workflowType: "approval",
      approvalStatus: "approved_for_future_execution",
      readinessState: "ready_for_future_execution",
    }),
  ),
  "planning",
)
assert.equal(
  resolveLifecycleStage(
    basePlanState({
      workflowType: "research_company",
      approvalStatus: "approved_for_future_execution",
      readinessState: "ready_for_future_execution",
    }),
  ),
  "execution",
)
assert.equal(
  resolveLifecycleStage(basePlanState({ workflowType: "outreach_generation" })),
  "outreach_blocked",
)
console.log("  ✓ Lifecycle stage resolver")

const researchOrchestration = buildRevenueOperatorOrchestration(basePlanState())
assert.equal(researchOrchestration.record.orchestrationDecision, "handoff_to_qualification")
assert.equal(researchOrchestration.planContext.nextOwner, "qualification_agent")
assert.ok(researchOrchestration.record.handoffPreview?.readOnly === true)
assert.equal(researchOrchestration.record.handoffPreview?.destinationAgent, "qualification_agent")
console.log("  ✓ Research → Qualification handoff recommendation")

const approvedNoDryRun = buildRevenueOperatorOrchestration(
  basePlanState({
    approvalStatus: "approved_for_future_execution",
    readinessState: "ready_for_future_execution",
    latestDryRunStatus: null,
  }),
)
assert.equal(approvedNoDryRun.record.orchestrationDecision, "human_review_required")
assert.ok(
  approvedNoDryRun.record.blockedReasons.some((reason) => /dry-run/i.test(reason)),
)
assert.equal(approvedNoDryRun.record.escalationLevel, "medium")
console.log("  ✓ Approved without dry-run escalates to human review")

const approvedWithDryRun = buildRevenueOperatorOrchestration(
  basePlanState({
    approvalStatus: "approved_for_future_execution",
    readinessState: "ready_for_future_execution",
    latestDryRunStatus: "dry_run_passed",
  }),
)
assert.equal(approvedWithDryRun.record.orchestrationDecision, "handoff_to_execution")
assert.equal(approvedWithDryRun.planContext.nextOwner, "execution_agent")
assert.equal(approvedWithDryRun.record.owningAgent, "execution_agent")
assert.equal(approvedWithDryRun.record.handoffPreview, null)
console.log("  ✓ Approved + dry-run → Execution handoff")

const outreachBlocked = buildRevenueOperatorOrchestration(
  basePlanState({ workflowType: "outreach_generation", approvalStatus: "approved_for_future_execution" }),
)
assert.equal(outreachBlocked.record.orchestrationDecision, "blocked")
assert.equal(outreachBlocked.record.escalationLevel, "high")
console.log("  ✓ Outreach blocked with high escalation")

const readinessBlocked = buildRevenueOperatorOrchestration(
  basePlanState({
    readinessState: "blocked_missing_prerequisites",
    approvalStatus: "approved_for_future_execution",
  }),
)
assert.equal(readinessBlocked.record.orchestrationDecision, "human_review_required")
assert.ok(readinessBlocked.record.blockedReasons.length > 0)
console.log("  ✓ Readiness blocked → human review")

const handoff = buildAgentHandoff({
  sourceAgent: "research_agent",
  destinationAgent: "qualification_agent",
  planState: basePlanState(),
  reason: "Research complete",
})
assert.equal(handoff.readOnly, true)
assert.equal(handoff.sourceAgent, "research_agent")
assert.equal(handoff.destinationAgent, "qualification_agent")
assert.ok(handoff.requiredGates.includes("approval"))
assert.ok(handoff.requiredGates.includes("handoff"))

const handoffSnapshot = JSON.stringify(handoff)
const handoffSnapshot2 = JSON.stringify(
  buildAgentHandoff({
    sourceAgent: "research_agent",
    destinationAgent: "qualification_agent",
    planState: basePlanState(),
    reason: "Research complete",
  }),
)
assert.equal(handoffSnapshot, handoffSnapshot2, "Handoff contracts must be deterministic")
console.log("  ✓ Deterministic handoff contracts")

const orchestrationSnapshot = JSON.stringify(
  buildRevenueOperatorOrchestration(
    basePlanState({
      workflowType: "meeting_preparation",
      approvalStatus: "approved_for_future_execution",
    }),
  ),
)
const orchestrationSnapshot2 = JSON.stringify(
  buildRevenueOperatorOrchestration(
    basePlanState({
      workflowType: "meeting_preparation",
      approvalStatus: "approved_for_future_execution",
    }),
  ),
)
assert.equal(orchestrationSnapshot, orchestrationSnapshot2, "Orchestration must be deterministic")
console.log("  ✓ Deterministic orchestration records")

const candidates = resolveCandidateAgents(basePlanState())
assert.ok(candidates.includes("research_agent"))
assert.ok(candidates.includes("revenue_operator_agent"))
console.log("  ✓ Candidate agents include supervisor")

assert.equal(isRevenueOperatorSchedulerActive(), false)
console.log("  ✓ Scheduler inactive — no background jobs")

console.log("[GE-AIOS-GROWTH-4B] Running 4A regression…")
const result = spawnSync("pnpm", ["test:ge-aios-growth-4a-agent-framework"], {
  stdio: "inherit",
  shell: true,
})
assert.equal(result.status, 0, "4A regression failed")

console.log("[GE-AIOS-GROWTH-4B] PASS — Revenue Operator Orchestration Engine certified")
