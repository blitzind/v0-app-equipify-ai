/**
 * GE-AIOS-GROWTH-4F — Mission Prioritization & Resource Allocation certification.
 * Run: pnpm test:ge-aios-growth-4f-priority-engine
 */
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  deriveMissionsForLead,
  type GrowthMissionDerivationInput,
} from "../lib/growth/aios/growth/growth-mission-framework-engine"
import {
  GROWTH_MISSION_CAPACITY_KINDS,
  GROWTH_MISSION_PRIORITY_QA_MARKER,
  GROWTH_MISSION_PRIORITY_RULE,
  GROWTH_MISSION_QUEUE_BUCKETS,
  GROWTH_MISSION_STARVATION_KINDS,
} from "../lib/growth/aios/growth/growth-mission-priority-types"
import {
  buildMissionPriorityPlanContext,
  buildMissionPriorityReadModel,
  buildMissionQueueBuckets,
  detectMissionStarvation,
  isMissionPrioritySchedulerActive,
  prioritizeAndAllocateMissions,
  scoreMissionPriority,
} from "../lib/growth/aios/growth/growth-mission-priority-engine"

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
    leadId: "lead-cert-4f",
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
    generatedAt: "2026-06-25T00:00:00.00Z",
    ...overrides,
  }
}

console.log("[GE-AIOS-GROWTH-4F] Mission Prioritization & Resource Allocation certification")

assert.equal(GROWTH_MISSION_PRIORITY_QA_MARKER, "growth-aios-growth-4f-mission-priority-v1")
assert.match(GROWTH_MISSION_PRIORITY_RULE, /read-only|without executing missions/i)
assert.equal(GROWTH_MISSION_CAPACITY_KINDS.length, 6)
assert.equal(GROWTH_MISSION_QUEUE_BUCKETS.length, 5)
assert.equal(GROWTH_MISSION_STARVATION_KINDS.length, 5)
console.log("  ✓ QA marker and capacity/queue/starvation enums")

assertNoForbiddenPaths("lib/growth/aios/growth/growth-mission-priority-types.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-mission-priority-engine.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-mission-priority-service.ts")
console.log("  ✓ No forbidden side-effect tokens")

const commandCenterUi = readSource(
  "components/growth/ai-os/command-center/growth-ai-os-mission-priorities-section.tsx",
)
assert.match(commandCenterUi, /Mission Priorities/)
assert.equal(commandCenterUi.toLowerCase().includes("execute mission"), false)
console.log("  ✓ Command Center Mission Priorities section — no execute controls")

const missionPlanning = readSource("lib/growth/aios/ai-executive-mission-planning-review-service.ts")
assert.match(missionPlanning, /buildGrowthMissionPriorityPlanContext/)
assert.match(missionPlanning, /missionPriorityContext/)

const missionPlanningUi = readSource(
  "components/growth/ai-os/growth/growth-ai-os-lead-research-execution-plan-section.tsx",
)
assert.match(missionPlanningUi, /mission-priority-context/)
console.log("  ✓ Mission Planning Review priority context")

const generatedAt = "2026-06-25T00:00:00.000Z"
const missions = deriveMissionsForLead(baseDerivation())
const missionSnapshot = JSON.stringify(
  prioritizeAndAllocateMissions({ missions, generatedAt }),
)
const missionSnapshot2 = JSON.stringify(
  prioritizeAndAllocateMissions({ missions, generatedAt }),
)
assert.equal(missionSnapshot, missionSnapshot2, "Prioritization must be deterministic")
console.log("  ✓ Deterministic prioritization and allocation")

const result = prioritizeAndAllocateMissions({ missions, generatedAt })
assert.ok(result.rankedMissions.length >= 1)
assert.ok(result.rankedMissions[0]!.priority.recommendedOrder === 1)
assert.ok(result.rankedMissions.every((row) => row.priority.overallPriority >= 0))
assert.ok(result.rankedMissions.every((row) => row.priority.overallPriority <= 100))
console.log("  ✓ Priority scores bounded 0–100 with recommended order")

const queues = buildMissionQueueBuckets(result.rankedMissions)
for (const bucket of GROWTH_MISSION_QUEUE_BUCKETS) {
  assert.ok(Array.isArray(queues[bucket]))
}
assert.equal(
  GROWTH_MISSION_QUEUE_BUCKETS.reduce((sum, bucket) => sum + queues[bucket].length, 0),
  result.rankedMissions.length,
)
console.log("  ✓ Deterministic queue buckets")

const starvation = detectMissionStarvation({
  missions: deriveMissionsForLead(
    baseDerivation({
      leadId: "lead-dup",
      lastUpdatedAt: "2026-06-01T00:00:00.000Z",
    }),
  ),
  allocations: result.rankedMissions,
  generatedAt,
})
assert.ok(Array.isArray(starvation))
console.log("  ✓ Starvation detection")

const readModel = buildMissionPriorityReadModel({ missions, generatedAt })
assert.equal(readModel.schedulerActive, false)
assert.equal(readModel.qaMarker, GROWTH_MISSION_PRIORITY_QA_MARKER)
assert.ok(readModel.revenueOperatorGuidance.highestValueWork.length > 0)
console.log("  ✓ Priority read model and Revenue Operator guidance")

const planContext = buildMissionPriorityPlanContext({
  leadId: "lead-cert-4f",
  rankedMissions: result.rankedMissions,
})
assert.ok(planContext)
assert.ok(planContext!.missionPriority.overallPriority >= 0)
console.log("  ✓ Mission planning priority context")

const scored = scoreMissionPriority(missions[0]!, { generatedAt })
assert.ok(scored.urgencyScore >= 0)
assert.ok(scored.businessValueScore >= 0)
assert.ok(scored.confidenceScore >= 0)
assert.ok(scored.effortScore >= 0)
assert.ok(scored.estimatedRoi >= 0)
console.log("  ✓ Mission priority score model")

assert.equal(isMissionPrioritySchedulerActive(), false)
console.log("  ✓ Scheduler inactive")

console.log("[GE-AIOS-GROWTH-4F] Running 4E regression…")
const regression = spawnSync("pnpm", ["test:ge-aios-growth-4e-mission-framework"], {
  stdio: "inherit",
  shell: true,
})
assert.equal(regression.status, 0, "4E regression failed")

console.log("[GE-AIOS-GROWTH-4F] PASS — Mission Prioritization & Resource Allocation certified")
