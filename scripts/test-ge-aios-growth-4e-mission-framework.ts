/**
 * GE-AIOS-GROWTH-4E — Mission & Goal Planning Framework certification.
 * Run: pnpm test:ge-aios-growth-4e-mission-framework
 */
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_MISSION_FRAMEWORK_QA_MARKER,
  GROWTH_MISSION_FRAMEWORK_RULE,
  GROWTH_MISSION_TYPES,
} from "../lib/growth/aios/growth/growth-mission-framework-types"
import {
  assessMissionHealth,
  buildMissionFrameworkReadModel,
  buildMissionPlanContext,
  buildMissionRecord,
  decomposeMission,
  deriveMissionTypesForLead,
  deriveMissionsForLead,
  isMissionFrameworkSchedulerActive,
  planMissions,
  resolveMissionDependencies,
} from "../lib/growth/aios/growth/growth-mission-framework-engine"

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
  overrides: Partial<Parameters<typeof buildMissionRecord>[0]> = {},
) {
  return {
    leadId: "lead-cert-4e",
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
    owningAgent: "execution_agent" as const,
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

console.log("[GE-AIOS-GROWTH-4E] Mission & Goal Planning Framework certification")

assert.equal(GROWTH_MISSION_FRAMEWORK_QA_MARKER, "growth-aios-growth-4e-mission-framework-v1")
assert.match(GROWTH_MISSION_FRAMEWORK_RULE, /read-only|without executing missions/i)
assert.equal(GROWTH_MISSION_TYPES.length, 8)
console.log("  ✓ QA marker and mission types")

assertNoForbiddenPaths("lib/growth/aios/growth/growth-mission-framework-types.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-mission-framework-engine.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-mission-framework-service.ts")
console.log("  ✓ No forbidden side-effect tokens")

const commandCenterUi = readSource(
  "components/growth/ai-os/command-center/growth-ai-os-missions-section.tsx",
)
assert.match(commandCenterUi, /Missions/)
assert.equal(commandCenterUi.toLowerCase().includes("execute mission"), false)
console.log("  ✓ Command Center Missions section — no execute controls")

const missionPlanning = readSource("lib/growth/aios/ai-executive-mission-planning-review-service.ts")
assert.match(missionPlanning, /buildGrowthMissionPlanContext/)
assert.match(missionPlanning, /missionPlanContext/)

const missionPlanningUi = readSource(
  "components/growth/ai-os/growth/growth-ai-os-lead-research-execution-plan-section.tsx",
)
assert.match(missionPlanningUi, /mission-plan-context/)
console.log("  ✓ Mission Planning Review mission context")

const enrichTypes = deriveMissionTypesForLead(
  baseDerivation({ researchSummary: null, workflowStatus: "not_started", qualificationSummary: null }),
)
assert.ok(enrichTypes.includes("enrich_account"))
console.log("  ✓ Deterministic mission generation")

const closeDecomposition = decomposeMission("close_opportunity")
assert.equal(closeDecomposition.primaryAgent, "revenue_operator_agent")
assert.ok(closeDecomposition.supportingAgents.includes("planning_agent"))
assert.ok(closeDecomposition.supportingAgents.includes("execution_agent"))
assert.ok(closeDecomposition.supportingAgents.includes("meeting_agent"))
console.log("  ✓ Deterministic mission decomposition")

const outreachDeps = resolveMissionDependencies("prepare_outreach")
assert.ok(outreachDeps.prerequisites.some((d) => d.missionType === "qualify_lead"))
assert.ok(outreachDeps.blocking.some((d) => d.missionType === "recover_failed_workflow"))
console.log("  ✓ Dependency resolution")

const missions = deriveMissionsForLead(baseDerivation())
const missionSnapshot = JSON.stringify(missions)
const missionSnapshot2 = JSON.stringify(deriveMissionsForLead(baseDerivation()))
assert.equal(missionSnapshot, missionSnapshot2, "Mission generation must be deterministic")
console.log("  ✓ Deterministic mission records")

const failedMission = buildMissionRecord(
  baseDerivation({
    runtimeState: "failed",
    workflowStatus: "failed",
    blockedReasons: ["Runtime failed"],
  }),
  "recover_failed_workflow",
)
const health = assessMissionHealth(failedMission, { generatedAt: "2026-06-25T00:00:00.000Z" })
assert.equal(health.state, "blocked")
console.log("  ✓ Mission health assessment")

const planner = planMissions(missions)
assert.ok(planner.completedMissions.length >= 1 || planner.activeMissions.length >= 1)
assert.ok(Array.isArray(planner.recommendedNewMissions))
console.log("  ✓ Revenue Operator mission planner")

const readModel = buildMissionFrameworkReadModel({
  missions,
  generatedAt: "2026-06-25T00:00:00.000Z",
})
assert.equal(readModel.summary.totalMissions, missions.length)
console.log("  ✓ Mission framework read model")

const planContext = buildMissionPlanContext(missions)
assert.ok(planContext)
assert.equal(planContext?.ownerAgent, missions[0]?.ownerAgent)
console.log("  ✓ Mission planning context")

assert.equal(isMissionFrameworkSchedulerActive(), false)
console.log("  ✓ Scheduler inactive")

console.log("[GE-AIOS-GROWTH-4E] Running 4D regression…")
const result = spawnSync("pnpm", ["test:ge-aios-growth-4d-agent-memory"], {
  stdio: "inherit",
  shell: true,
})
assert.equal(result.status, 0, "4D regression failed")

console.log("[GE-AIOS-GROWTH-4E] PASS — Mission & Goal Planning Framework certified")
