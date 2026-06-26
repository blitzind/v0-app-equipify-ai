/**
 * GE-AIOS-GROWTH-5D — Autonomous Planning Agent Pilot certification.
 * Run: pnpm test:ge-aios-growth-5d-autonomous-planning-agent
 */
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { assessGrowthLeadResearchOpportunity } from "../lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import { GROWTH_AGENT_KINDS } from "../lib/growth/aios/growth/growth-agent-framework-types"
import {
  applyPlanningPilotControlTransition,
  buildAutonomousPlanningPilotPlanContext,
  buildAutonomousPlanningPilotReadModel,
  buildAutonomousPlanningRunRecord,
  enforcePlanningAgentBudget,
  evaluateAutonomousPlanningDecision,
  evaluatePlanningMemoryReadiness,
  evaluatePlanningWakeCondition,
  hasRecentDuplicatePlan,
  isLeadInPlanningFailureCooldown,
  isPlanningAgentSchedulerActive,
  selectPlanningWakeCandidates,
} from "../lib/growth/aios/growth/growth-autonomous-planning-pilot-engine"
import {
  evaluateAutonomousQualificationDecision,
  buildResearchResultFromWorkflowSnapshot,
} from "../lib/growth/aios/growth/growth-autonomous-qualification-pilot-engine"
import {
  GROWTH_AUTONOMOUS_PLANNING_EXECUTION_PLAN_GENERATED_EVENT,
  GROWTH_AUTONOMOUS_PLANNING_PILOT_AGENT,
  GROWTH_AUTONOMOUS_PLANNING_PILOT_BUDGET,
  GROWTH_AUTONOMOUS_PLANNING_PILOT_QA_MARKER,
  GROWTH_AUTONOMOUS_PLANNING_PILOT_RULE,
  GROWTH_AUTONOMOUS_PLANNING_PILOT_SCHEDULER_MODE,
  GROWTH_AUTONOMOUS_PLANNING_PILOT_WAKE_CONDITIONS,
} from "../lib/growth/aios/growth/growth-autonomous-planning-pilot-types"
import {
  appendAutonomousPlanningRun,
  resetAutonomousPlanningPilotOrgState,
  setAutonomousPlanningPilotControlState,
} from "../lib/growth/aios/growth/growth-autonomous-planning-pilot-store"
import {
  buildGrowthAiOsAutonomyPolicyReadModel,
  evaluatePlanningPilotAutonomyPolicyGate,
} from "../lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"
import { buildDefaultGrowthAutonomySettings } from "../lib/growth/autonomy/growth-autonomy-config"
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

const ORG = "org-cert-5d"
const GENERATED_AT = "2026-06-25T15:00:00.000Z"
const LEAD = "lead-cert-5d"

const researchCompleteSnapshot = {
  workflowKey: "growth_lead_research" as const,
  workflowStatus: "research_complete" as const,
  leadId: LEAD,
  missionId: "mission-1",
  workOrderId: null,
  researchRunId: "run-research-1",
  qualification: null,
  opportunityAssessment: null,
  nextBestAction: null,
  evidenceSummary: {
    verifiedEvidence: ["Company summary: Regional HVAC contractor with fleet operations."],
    missingEvidence: [],
    potentialRisks: [],
    assumptions: [],
    humanReviewNotes: [],
  },
  executionPlan: null,
  updatedAt: GENERATED_AT,
}

const qualificationDecision = evaluateAutonomousQualificationDecision({
  snapshot: researchCompleteSnapshot,
  companyName: "Cert Co",
})
assert.ok(qualificationDecision)

const planningIntelligence = assessGrowthLeadResearchOpportunity({
  result: buildResearchResultFromWorkflowSnapshot({
    snapshot: researchCompleteSnapshot,
    companyName: "Cert Co",
  }),
  qualification: qualificationDecision.qualification,
})

const qualifiedSnapshot = {
  ...researchCompleteSnapshot,
  workflowStatus: "qualified" as const,
  qualification: qualificationDecision.qualification,
  opportunityAssessment: planningIntelligence.opportunityAssessment,
  nextBestAction: planningIntelligence.nextBestAction,
  evidenceSummary: planningIntelligence.evidenceSummary,
}

console.log("[GE-AIOS-GROWTH-5D] Autonomous Planning Agent Pilot certification")

assert.equal(GROWTH_AUTONOMOUS_PLANNING_PILOT_QA_MARKER, "growth-aios-growth-5d-autonomous-planning-pilot-v1")
assert.match(GROWTH_AUTONOMOUS_PLANNING_PILOT_RULE, /Planning Agent|no outbound/i)
assert.equal(GROWTH_AUTONOMOUS_PLANNING_PILOT_AGENT, "planning_agent")
assert.equal(GROWTH_AUTONOMOUS_PLANNING_PILOT_SCHEDULER_MODE, "controlled_agent_wake")
assert.equal(GROWTH_AUTONOMOUS_PLANNING_PILOT_WAKE_CONDITIONS.length, 3)
assert.equal(GROWTH_AUTONOMOUS_PLANNING_PILOT_BUDGET.maxRunsPerHour, 15)
assert.equal(GROWTH_AUTONOMOUS_PLANNING_PILOT_BUDGET.maxRunsPerDay, 150)
assert.equal(GROWTH_AUTONOMOUS_PLANNING_PILOT_BUDGET.maxRetriesPerLeadPerDay, 2)
assert.equal(GROWTH_AUTONOMOUS_PLANNING_EXECUTION_PLAN_GENERATED_EVENT, "growth.execution_plan.generated")
console.log("  ✓ QA marker and pilot constants")

assertNoForbiddenPaths("lib/growth/aios/growth/growth-autonomous-planning-pilot-types.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-autonomous-planning-pilot-engine.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-autonomous-planning-pilot-store.ts")
console.log("  ✓ No forbidden side-effect tokens in engine/types/store")

const serviceSource = readSource("lib/growth/aios/growth/growth-autonomous-planning-pilot-service.ts")
assert.equal(serviceSource.includes("invokeAiOsProvider"), false)
assert.equal(serviceSource.includes("enqueueRuntime"), false)
assert.equal(serviceSource.includes("createAiWorkOrder"), false)
assert.match(serviceSource, /fetchGrowthAiOsAutonomyPolicyEvaluationContext/)
assert.match(serviceSource, /evaluatePlanningPilotAutonomyPolicyGate/)
assert.match(serviceSource, /GROWTH_AUTONOMOUS_PLANNING_EXECUTION_PLAN_GENERATED_EVENT/)
const engineSource = readSource("lib/growth/aios/growth/growth-autonomous-planning-pilot-engine.ts")
assert.match(engineSource, /planGrowthLeadResearchExecution/)
console.log("  ✓ Pilot cycle consults policy evaluation context and wraps planning logic")

const actionRoute = readSource("app/api/platform/growth/ai-os/autonomous-planning-pilot/action/route.ts")
assert.match(actionRoute, /403/)
assert.match(actionRoute, /policy_control_plane_required/)
console.log("  ✓ Legacy action API policy-gated")

const commandCenterUi = readSource(
  "components/growth/ai-os/command-center/growth-ai-os-autonomous-planning-pilot-section.tsx",
)
assert.match(commandCenterUi, /Autonomous Planning Agent/)
assert.match(commandCenterUi, /Configure in Growth Autonomy/)
assert.equal(commandCenterUi.includes("onAction"), false)
console.log("  ✓ Command Center pilot section read-only with Growth Autonomy deep link")

const missionPlanning = readSource("lib/growth/aios/ai-executive-mission-planning-review-service.ts")
assert.match(missionPlanning, /buildGrowthAutonomousPlanningPilotPlanContext/)
assert.match(missionPlanning, /autonomousPlanningPilotContext/)

const missionPlanningUi = readSource(
  "components/growth/ai-os/growth/growth-ai-os-lead-research-execution-plan-section.tsx",
)
assert.match(missionPlanningUi, /autonomous-planning-pilot-context/)
console.log("  ✓ Mission Planning Review planning context")

assert.equal(evaluatePlanningMemoryReadiness(null).sufficient, false)
assert.equal(evaluatePlanningMemoryReadiness(researchCompleteSnapshot).sufficient, false)
assert.equal(evaluatePlanningMemoryReadiness(qualifiedSnapshot).sufficient, true)
assert.equal(
  evaluatePlanningWakeCondition({
    leadId: LEAD,
    snapshot: qualifiedSnapshot,
    runs: [],
    generatedAt: GENERATED_AT,
    companyName: "Cert Co",
  }),
  "qualification_completed",
)
assert.equal(
  evaluatePlanningWakeCondition({
    leadId: LEAD,
    snapshot: researchCompleteSnapshot,
    runs: [],
    generatedAt: GENERATED_AT,
  }),
  null,
)
console.log("  ✓ Wake conditions require successful qualification")

const schedulerWakeRules = buildSchedulerWakeRules()
const planningWake = schedulerWakeRules.find((rule) => rule.agentKind === "planning_agent")
const qualificationWake = schedulerWakeRules.find((rule) => rule.agentKind === "qualification_agent")
const researchWake = schedulerWakeRules.find((rule) => rule.agentKind === "research_agent")
assert.ok(planningWake)
assert.ok(qualificationWake)
assert.ok(researchWake)
assert.ok(planningWake!.allowedSchedulerModes.includes("controlled_agent_wake"))
assert.ok(planningWake!.wakeAllowedInPhase)
for (const kind of GROWTH_AGENT_KINDS) {
  if (
    kind === "research_agent" ||
    kind === "qualification_agent" ||
    kind === "planning_agent" ||
    kind === "execution_agent" ||
    kind === "outreach_agent" ||
    kind === "meeting_agent"
  ) {
    continue
  }
  const rule = schedulerWakeRules.find((row) => row.agentKind === kind)
  assert.equal(rule?.wakeAllowedInPhase, false)
}
console.log("  ✓ Pilot-phase agents may wake through meeting_agent")

resetAutonomousPlanningPilotOrgState(ORG)
assert.equal(isPlanningAgentSchedulerActive("disabled"), false)
assert.equal(isPlanningAgentSchedulerActive("active"), true)

let control = applyPlanningPilotControlTransition({ current: "disabled", action: "resume" })
assert.equal(control, "active")
control = applyPlanningPilotControlTransition({ current: "active", action: "disable" })
assert.equal(control, "disabled")
setAutonomousPlanningPilotControlState({ organizationId: ORG, controlState: control, now: GENERATED_AT })
console.log("  ✓ Control transitions")

const planningDecision = evaluateAutonomousPlanningDecision({
  snapshot: qualifiedSnapshot,
  companyName: "Cert Co",
})
assert.ok(planningDecision)
assert.ok(planningDecision.planId.length > 0)
assert.ok(planningDecision.revenueOperatorHandoff.length > 0)

const runs = Array.from({ length: 15 }, (_, index) =>
  buildAutonomousPlanningRunRecord({
    leadId: `lead-${index}`,
    companyName: "Cert Co",
    wakeCondition: "qualification_completed",
    generatedAt: new Date(Date.parse(GENERATED_AT) - index * 60_000).toISOString(),
    outcome: "completed",
    decision: planningDecision,
  }),
)
const budgetBlocked = enforcePlanningAgentBudget({ runs, generatedAt: GENERATED_AT })
assert.equal(budgetBlocked.allowed, false)
console.log("  ✓ Hourly budget limits enforced")

const failedRun = buildAutonomousPlanningRunRecord({
  leadId: LEAD,
  companyName: "Cert Co",
  wakeCondition: "qualification_completed",
  generatedAt: new Date(Date.parse(GENERATED_AT) - 5 * 60_000).toISOString(),
  outcome: "failed",
})
assert.equal(
  isLeadInPlanningFailureCooldown({
    runs: [failedRun],
    leadId: LEAD,
    generatedAt: GENERATED_AT,
  }),
  true,
)
console.log("  ✓ Failure cooldown enforced")

const readModel = buildAutonomousPlanningPilotReadModel({
  controlState: "active",
  runs,
  generatedAt: GENERATED_AT,
  eligibleLeads: 2,
})
const readModel2 = buildAutonomousPlanningPilotReadModel({
  controlState: "active",
  runs,
  generatedAt: GENERATED_AT,
  eligibleLeads: 2,
})
assert.equal(JSON.stringify(readModel), JSON.stringify(readModel2))
assert.deepEqual(readModel.disabledAgentKinds, ["meeting_agent"])
assert.ok(readModel.revenueOperatorSupervision.latestHandoffRecommendation)
console.log("  ✓ Deterministic read model and Revenue Operator handoff")

assert.match(engineSource, /planGrowthLeadResearchExecution/)
console.log("  ✓ Planning engine reuses deterministic execution planning service")

const settings = buildDefaultGrowthAutonomySettings(ORG)
settings.masterMode = "assisted"
settings.capabilityToggles.recommendations = true
settings.capabilityToggles.enrichment = true
settings.capabilityToggles.research = true
const allowedPolicy = buildGrowthAiOsAutonomyPolicyReadModel({
  organizationId: ORG,
  generatedAt: GENERATED_AT,
  settings: {
    ...settings,
    killSwitches: {
      autonomyEnabled: true,
      autonomyOutboundEnabled: true,
      autonomyGenerationEnabled: true,
      autonomyObjectiveModeEnabled: false,
    },
  },
  runtimeEnabled: false,
  runtimePilotEnabled: false,
})
assert.equal(evaluatePlanningPilotAutonomyPolicyGate({ policy: allowedPolicy, settings }).allowed, true)

settings.capabilityToggles.recommendations = false
const blockedPolicy = buildGrowthAiOsAutonomyPolicyReadModel({
  organizationId: ORG,
  generatedAt: GENERATED_AT,
  settings: {
    ...settings,
    killSwitches: {
      autonomyEnabled: true,
      autonomyOutboundEnabled: true,
      autonomyGenerationEnabled: true,
      autonomyObjectiveModeEnabled: false,
    },
  },
  runtimeEnabled: false,
  runtimePilotEnabled: false,
})
assert.equal(evaluatePlanningPilotAutonomyPolicyGate({ policy: blockedPolicy, settings }).allowed, false)
console.log("  ✓ Policy engine gate blocks disabled recommendations capability")

const missions = deriveMissionsForLead({
  leadId: LEAD,
  companyName: "Cert Co",
  workflowType: "research_company",
  workflowStatus: "qualified",
  researchSummary: "Research complete",
  qualificationSummary: "Qualified",
  opportunityAssessment: planningIntelligence.opportunityAssessment.summary,
  nextBestAction: planningIntelligence.nextBestAction.action,
  approvalState: "approved_for_future_execution",
  readinessState: "ready_for_future_execution",
  runtimeState: null,
  dryRunState: "dry_run_passed",
  owningAgent: "planning_agent",
  revenueOperatorRecommendation: "Plan after qualification",
  blockedReasons: [],
  humanReviewRequirements: [],
  confidence: 0.7,
  completenessState: "complete",
  orchestrationDecision: "handoff_to_planning_agent",
  outboundRecommended: true,
  lastUpdatedAt: GENERATED_AT,
  generatedAt: GENERATED_AT,
})
const allocation = prioritizeAndAllocateMissions({ missions, generatedAt: GENERATED_AT })
const candidates = selectPlanningWakeCandidates({ rankedMissions: allocation.rankedMissions })
assert.ok(candidates.length >= 1)
console.log("  ✓ Planning wake candidates from priority queue")

const planContext = buildAutonomousPlanningPilotPlanContext({
  leadId: LEAD,
  snapshot: qualifiedSnapshot,
  controlState: "active",
  runs: [],
  generatedAt: GENERATED_AT,
})
assert.equal(planContext.planningAgentOwner, "planning_agent")
assert.equal(planContext.planningStatus, "pending")
console.log("  ✓ Mission planning planning context")

assert.equal(
  hasRecentDuplicatePlan({
    runs: [
      buildAutonomousPlanningRunRecord({
        leadId: LEAD,
        companyName: "Cert Co",
        wakeCondition: "qualification_completed",
        generatedAt: GENERATED_AT,
        outcome: "completed",
        decision: planningDecision,
      }),
    ],
    leadId: LEAD,
    planId: planningDecision.planId,
    generatedAt: GENERATED_AT,
  }),
  true,
)
console.log("  ✓ Duplicate execution plan prevention")

for (const run of runs.slice(0, 3)) {
  appendAutonomousPlanningRun({ organizationId: ORG, run, now: GENERATED_AT })
}
const duplicateBlocked = enforcePlanningAgentBudget({
  runs: [
    ...runs,
    buildAutonomousPlanningRunRecord({
      leadId: LEAD,
      companyName: "Cert Co",
      wakeCondition: "qualification_completed",
      generatedAt: GENERATED_AT,
      outcome: "completed",
      decision: planningDecision,
    }),
    buildAutonomousPlanningRunRecord({
      leadId: LEAD,
      companyName: "Cert Co",
      wakeCondition: "qualification_completed",
      generatedAt: GENERATED_AT,
      outcome: "completed",
      decision: planningDecision,
    }),
  ],
  generatedAt: GENERATED_AT,
  leadId: LEAD,
})
assert.equal(duplicateBlocked.allowed, false)
console.log("  ✓ Per-lead retry budget enforced")

console.log("[GE-AIOS-GROWTH-5D] Running 5C regression…")
const regression5c = spawnSync("pnpm", ["test:ge-aios-growth-5c-autonomous-qualification-agent"], {
  stdio: "inherit",
  shell: true,
})
assert.equal(regression5c.status, 0, "5C regression failed")

console.log("[GE-AIOS-GROWTH-5D] Autonomous Planning Agent Pilot certification PASSED")
