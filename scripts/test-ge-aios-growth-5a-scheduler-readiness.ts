/**
 * GE-AIOS-GROWTH-5A — Scheduler Readiness & Activation Plan certification.
 * Run: pnpm test:ge-aios-growth-5a-scheduler-readiness
 */
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_AGENT_KINDS } from "../lib/growth/aios/growth/growth-agent-framework-types"
import {
  deriveMissionsForLead,
  type GrowthMissionDerivationInput,
} from "../lib/growth/aios/growth/growth-mission-framework-engine"
import { buildMissionPriorityReadModel } from "../lib/growth/aios/growth/growth-mission-priority-engine"
import {
  GROWTH_SCHEDULER_ACTIVATION_STATUSES,
  GROWTH_SCHEDULER_PHASE_ALLOWED_MODES,
  GROWTH_SCHEDULER_READINESS_QA_MARKER,
  GROWTH_SCHEDULER_READINESS_RULE,
  GROWTH_SCHEDULER_MODES,
} from "../lib/growth/aios/growth/growth-scheduler-readiness-types"
import {
  buildAgentWakeRules,
  buildSchedulerBudgetLimits,
  buildSchedulerPriorityQueueSnapshot,
  buildSchedulerReadinessPlanContext,
  buildSchedulerReadinessReadModel,
  buildSchedulerThrottleRules,
  isSchedulerReadinessActive,
} from "../lib/growth/aios/growth/growth-scheduler-readiness-engine"

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

function baseDerivation(
  overrides: Partial<GrowthMissionDerivationInput> = {},
): GrowthMissionDerivationInput {
  return {
    leadId: "lead-cert-5a",
    companyName: "Cert Co",
    workflowType: "research_company",
    workflowStatus: "assessed",
    researchSummary: "Research complete",
    qualificationSummary: "Fit 80",
    opportunityAssessment: "High fit",
    nextBestAction: "Verify email",
    approvalState: "approved_for_future_execution",
    readinessState: "ready_for_future_execution",
    runtimeState: null,
    dryRunState: "dry_run_passed",
    owningAgent: "execution_agent",
    revenueOperatorRecommendation: "Hand off to Execution Agent",
    blockedReasons: [],
    humanReviewRequirements: [],
    confidence: 0.8,
    completenessState: "complete",
    orchestrationDecision: "handoff_to_execution",
    outboundRecommended: false,
    lastUpdatedAt: "2026-06-25T00:00:00.000Z",
    generatedAt: "2026-06-25T00:00:00.000Z",
    ...overrides,
  }
}

console.log("[GE-AIOS-GROWTH-5A] Scheduler Readiness & Activation Plan certification")

assert.equal(GROWTH_SCHEDULER_READINESS_QA_MARKER, "growth-aios-growth-5a-scheduler-readiness-v1")
assert.match(GROWTH_SCHEDULER_READINESS_RULE, /readiness|without activating schedulers/i)
assert.equal(GROWTH_SCHEDULER_MODES.length, 5)
assert.deepEqual([...GROWTH_SCHEDULER_PHASE_ALLOWED_MODES], ["disabled", "priority_queue_preview"])
assert.equal(GROWTH_SCHEDULER_ACTIVATION_STATUSES.length, 8)
console.log("  ✓ QA marker and scheduler enums")

assertNoForbiddenPaths("lib/growth/aios/growth/growth-scheduler-readiness-types.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-scheduler-readiness-engine.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-scheduler-readiness-service.ts")
console.log("  ✓ No forbidden side-effect tokens")

const commandCenterUi = readSource(
  "components/growth/ai-os/command-center/growth-ai-os-scheduler-readiness-section.tsx",
)
assert.match(commandCenterUi, /Scheduler Readiness/)
assert.equal(commandCenterUi.toLowerCase().includes("activate scheduler"), false)
assert.equal(commandCenterUi.toLowerCase().includes("wake agent"), false)
console.log("  ✓ Command Center Scheduler Readiness — no activation controls")

const missionPlanning = readSource("lib/growth/aios/ai-executive-mission-planning-review-service.ts")
assert.match(missionPlanning, /buildGrowthSchedulerReadinessPlanContext/)
assert.match(missionPlanning, /schedulerReadinessContext/)

const missionPlanningUi = readSource(
  "components/growth/ai-os/growth/growth-ai-os-lead-research-execution-plan-section.tsx",
)
assert.match(missionPlanningUi, /scheduler-readiness-context/)
console.log("  ✓ Mission Planning Review scheduler context")

const generatedAt = "2026-06-25T00:00:00.000Z"
const missions = deriveMissionsForLead(baseDerivation())
const missionPriority = buildMissionPriorityReadModel({ missions, generatedAt })

const snapshot = JSON.stringify(
  buildSchedulerReadinessReadModel({
    organizationId: "org-cert-5a",
    missionPriority,
    generatedAt,
  }),
)
const snapshot2 = JSON.stringify(
  buildSchedulerReadinessReadModel({
    organizationId: "org-cert-5a",
    missionPriority,
    generatedAt,
  }),
)
assert.equal(snapshot, snapshot2, "Scheduler readiness must be deterministic")
console.log("  ✓ Deterministic readiness status")

const readModel = JSON.parse(snapshot) as ReturnType<typeof buildSchedulerReadinessReadModel>
assert.equal(readModel.schedulerActive, false)
assert.equal(readModel.readiness.schedulerMode, "disabled")
assert.ok(GROWTH_SCHEDULER_ACTIVATION_STATUSES.includes(readModel.readiness.activationStatus))
console.log("  ✓ Scheduler inactive with valid activation status")

const wakeRules = buildAgentWakeRules()
assert.equal(wakeRules.length, GROWTH_AGENT_KINDS.length)
assert.ok(wakeRules.every((rule) =>
  rule.agentKind === "research_agent" ||
  rule.agentKind === "qualification_agent" ||
  rule.agentKind === "planning_agent" ||
  rule.agentKind === "execution_agent" ||
  rule.agentKind === "outreach_agent" ||
  rule.agentKind === "meeting_agent" ||
  rule.wakeAllowedInPhase === false,
))
console.log("  ✓ Deterministic wake rules — pilot agents through meeting_agent gated in later phases")

const wakeSnapshot = JSON.stringify(wakeRules)
assert.equal(wakeSnapshot, JSON.stringify(buildAgentWakeRules()), "Wake rules must be deterministic")

const queueSnapshot = buildSchedulerPriorityQueueSnapshot(missionPriority)
assert.equal(queueSnapshot.prioritySource, "GE-AIOS-GROWTH-4F")
assert.ok(Array.isArray(queueSnapshot.starvationWarnings))
console.log("  ✓ Priority queues consumed read-only from 4F")

const budget = buildSchedulerBudgetLimits()
const throttle = buildSchedulerThrottleRules()
assert.ok(budget.maxAgentPreviewsPerHour > 0)
assert.equal(budget.maxOutboundCandidatesPerDay, 0)
assert.equal(throttle.outboundCandidateThrottlePerDay, 0)
console.log("  ✓ Budget and throttle rules generated")

const planContext = buildSchedulerReadinessPlanContext({
  leadId: "lead-cert-5a",
  missionPriority,
  readiness: readModel,
})
assert.ok(planContext)
assert.ok(planContext!.queueSource.includes("GE-AIOS-GROWTH-4F"))
console.log("  ✓ Mission planning scheduler context")

assert.equal(isSchedulerReadinessActive(), false)
console.log("  ✓ Scheduler remains inactive")

console.log("[GE-AIOS-GROWTH-5A] Running 4F regression…")
const regression = spawnSync("pnpm", ["test:ge-aios-growth-4f-priority-engine"], {
  stdio: "inherit",
  shell: true,
})
assert.equal(regression.status, 0, "4F regression failed")

console.log("[GE-AIOS-GROWTH-5A] PASS — Scheduler Readiness & Activation Plan certified")
