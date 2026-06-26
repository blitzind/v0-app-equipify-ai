/**
 * GE-AIOS-GROWTH-5B — Autonomous Research Agent Pilot certification.
 * Run: pnpm test:ge-aios-growth-5b-autonomous-research-agent
 */
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_AGENT_KINDS } from "../lib/growth/aios/growth/growth-agent-framework-types"
import {
  applyPilotControlTransition,
  buildAutonomousResearchPilotPlanContext,
  buildAutonomousResearchPilotReadModel,
  buildAutonomousResearchRunRecord,
  enforceResearchAgentBudget,
  evaluateWakeCondition,
  isResearchAgentSchedulerActive,
  selectResearchWakeCandidates,
} from "../lib/growth/aios/growth/growth-autonomous-research-pilot-engine"
import {
  GROWTH_AUTONOMOUS_RESEARCH_PILOT_AGENT,
  GROWTH_AUTONOMOUS_RESEARCH_PILOT_BUDGET,
  GROWTH_AUTONOMOUS_RESEARCH_PILOT_QA_MARKER,
  GROWTH_AUTONOMOUS_RESEARCH_PILOT_RULE,
  GROWTH_AUTONOMOUS_RESEARCH_PILOT_SCHEDULER_MODE,
  GROWTH_AUTONOMOUS_RESEARCH_PILOT_WAKE_CONDITIONS,
} from "../lib/growth/aios/growth/growth-autonomous-research-pilot-types"
import {
  appendAutonomousResearchRun,
  resetAutonomousResearchPilotOrgState,
  setAutonomousResearchPilotControlState,
} from "../lib/growth/aios/growth/growth-autonomous-research-pilot-store"
import { deriveMissionsForLead } from "../lib/growth/aios/growth/growth-mission-framework-engine"
import { prioritizeAndAllocateMissions } from "../lib/growth/aios/growth/growth-mission-priority-engine"
import { buildAgentWakeRules as buildSchedulerWakeRules } from "../lib/growth/aios/growth/growth-scheduler-readiness-engine"

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

const ORG = "org-cert-5b"
const GENERATED_AT = "2026-06-25T12:00:00.000Z"
const LEAD = "lead-cert-5b"

console.log("[GE-AIOS-GROWTH-5B] Autonomous Research Agent Pilot certification")

assert.equal(GROWTH_AUTONOMOUS_RESEARCH_PILOT_QA_MARKER, "growth-aios-growth-5b-autonomous-research-pilot-v1")
assert.match(GROWTH_AUTONOMOUS_RESEARCH_PILOT_RULE, /Research Agent|no outbound/i)
assert.equal(GROWTH_AUTONOMOUS_RESEARCH_PILOT_AGENT, "research_agent")
assert.equal(GROWTH_AUTONOMOUS_RESEARCH_PILOT_SCHEDULER_MODE, "controlled_agent_wake")
assert.equal(GROWTH_AUTONOMOUS_RESEARCH_PILOT_WAKE_CONDITIONS.length, 4)
assert.equal(GROWTH_AUTONOMOUS_RESEARCH_PILOT_BUDGET.maxRunsPerHour, 10)
assert.equal(GROWTH_AUTONOMOUS_RESEARCH_PILOT_BUDGET.maxRunsPerDay, 100)
console.log("  ✓ QA marker and pilot constants")

assertNoForbiddenPaths("lib/growth/aios/growth/growth-autonomous-research-pilot-types.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-autonomous-research-pilot-engine.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-autonomous-research-pilot-store.ts")
console.log("  ✓ No forbidden side-effect tokens in engine/types/store")

const serviceSource = readSource("lib/growth/aios/growth/growth-autonomous-research-pilot-service.ts")
assert.equal(serviceSource.includes("invokeAiOsProvider"), false)
assert.equal(serviceSource.includes("enqueueRuntime"), false)
assert.equal(serviceSource.includes("createAiWorkOrder"), false)
assert.match(serviceSource, /fetchGrowthAiOsAutonomyPolicy/)
assert.match(serviceSource, /evaluateResearchPilotAutonomyPolicyGate/)
console.log("  ✓ Pilot cycle consults autonomy policy engine")

const commandCenterUi = readSource(
  "components/growth/ai-os/command-center/growth-ai-os-autonomous-research-pilot-section.tsx",
)
assert.match(commandCenterUi, /Autonomous Research Agent/)
assert.match(commandCenterUi, /Configure in Growth Autonomy/)
assert.equal(commandCenterUi.includes("onAction"), false)
assert.equal(commandCenterUi.toLowerCase().includes("outbound"), false)
console.log("  ✓ Command Center pilot section read-only with Growth Autonomy deep link")

const missionPlanning = readSource("lib/growth/aios/ai-executive-mission-planning-review-service.ts")
assert.match(missionPlanning, /buildGrowthAutonomousResearchPilotPlanContext/)
assert.match(missionPlanning, /autonomousResearchPilotContext/)

const missionPlanningUi = readSource(
  "components/growth/ai-os/growth/growth-ai-os-lead-research-execution-plan-section.tsx",
)
assert.match(missionPlanningUi, /autonomous-research-pilot-context/)
console.log("  ✓ Mission Planning Review autonomous research context")

const wakeSnapshot = JSON.stringify(
  evaluateWakeCondition({
    leadId: LEAD,
    snapshot: null,
    generatedAt: GENERATED_AT,
  }),
)
assert.equal(wakeSnapshot, JSON.stringify("newly_discovered_lead"))
assert.equal(
  evaluateWakeCondition({
    leadId: LEAD,
    snapshot: {
      workflowKey: "growth_lead_research",
      workflowStatus: "research_complete",
      leadId: LEAD,
      missionId: null,
      workOrderId: null,
      researchRunId: "run-1",
      qualification: null,
      opportunityAssessment: null,
      nextBestAction: null,
      evidenceSummary: null,
      executionPlan: null,
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
    generatedAt: GENERATED_AT,
  }),
  "stale_research",
)
console.log("  ✓ Deterministic wake conditions")

const schedulerWakeRules = buildSchedulerWakeRules()
const researchWake = schedulerWakeRules.find((rule) => rule.agentKind === "research_agent")
assert.ok(researchWake)
assert.ok(researchWake!.allowedSchedulerModes.includes("controlled_agent_wake"))
assert.ok(researchWake!.wakeAllowedInPhase)
console.log("  ✓ Research Agent may wake in pilot scope")

resetAutonomousResearchPilotOrgState(ORG)
assert.equal(isResearchAgentSchedulerActive("disabled"), false)
assert.equal(isResearchAgentSchedulerActive("paused"), false)
assert.equal(isResearchAgentSchedulerActive("active"), true)

let control = applyPilotControlTransition({ current: "disabled", action: "resume" })
assert.equal(control, "active")
control = applyPilotControlTransition({ current: "active", action: "pause" })
assert.equal(control, "paused")
control = applyPilotControlTransition({ current: "paused", action: "resume" })
assert.equal(control, "active")
control = applyPilotControlTransition({ current: "active", action: "disable" })
assert.equal(control, "disabled")
setAutonomousResearchPilotControlState({ organizationId: ORG, controlState: control, now: GENERATED_AT })
console.log("  ✓ Pause, resume, disable transitions")

const runs = Array.from({ length: 10 }, (_, index) =>
  buildAutonomousResearchRunRecord({
    leadId: `lead-${index}`,
    companyName: "Cert Co",
    wakeCondition: "scheduled_research_refresh",
    generatedAt: new Date(Date.parse(GENERATED_AT) - index * 60_000).toISOString(),
    outcome: "completed",
    snapshot: null,
  }),
)
const budgetBlocked = enforceResearchAgentBudget({ runs, generatedAt: GENERATED_AT })
assert.equal(budgetBlocked.allowed, false)
console.log("  ✓ Budget limits enforced")

for (const run of runs) {
  appendAutonomousResearchRun({ organizationId: ORG, run, now: GENERATED_AT })
}
const readModel = buildAutonomousResearchPilotReadModel({
  controlState: "active",
  runs,
  generatedAt: GENERATED_AT,
})
const readModel2 = buildAutonomousResearchPilotReadModel({
  controlState: "active",
  runs,
  generatedAt: GENERATED_AT,
})
assert.equal(JSON.stringify(readModel), JSON.stringify(readModel2))
assert.equal(readModel.schedulerMode, "controlled_agent_wake")
assert.equal(readModel.otherAgentsDisabled, true)
assert.ok(readModel.revenueOperatorSupervision.approveWakeRecommendation.length > 0)
console.log("  ✓ Deterministic read model and Revenue Operator supervision")

const missions = deriveMissionsForLead({
  leadId: LEAD,
  companyName: "Cert Co",
  workflowType: "research_company",
  workflowStatus: "not_started",
  researchSummary: null,
  qualificationSummary: null,
  opportunityAssessment: null,
  nextBestAction: "Research",
  approvalState: "approved_for_future_execution",
  readinessState: "ready_for_future_execution",
  runtimeState: null,
  dryRunState: "dry_run_passed",
  owningAgent: "execution_agent",
  revenueOperatorRecommendation: "Research first",
  blockedReasons: [],
  humanReviewRequirements: [],
  confidence: 0.7,
  completenessState: "partial",
  orchestrationDecision: "continue_research",
  outboundRecommended: false,
  lastUpdatedAt: GENERATED_AT,
  generatedAt: GENERATED_AT,
})
const allocation = prioritizeAndAllocateMissions({ missions, generatedAt: GENERATED_AT })
const candidates = selectResearchWakeCandidates({ rankedMissions: allocation.rankedMissions })
assert.ok(candidates.length >= 1)
console.log("  ✓ Research wake candidates from priority queue")

const planContext = buildAutonomousResearchPilotPlanContext({
  leadId: LEAD,
  snapshot: null,
  controlState: "active",
  runs: [],
  generatedAt: GENERATED_AT,
})
assert.ok(planContext)
assert.equal(planContext?.staleStatus, "unknown")
console.log("  ✓ Mission planning pilot context")

console.log("[GE-AIOS-GROWTH-5B] Running 5A regression…")
const regression = spawnSync("pnpm", ["test:ge-aios-growth-5a-scheduler-readiness"], {
  stdio: "inherit",
  shell: true,
})
assert.equal(regression.status, 0, "5A regression failed")

console.log("[GE-AIOS-GROWTH-5B] PASS — Autonomous Research Agent Pilot certified")
