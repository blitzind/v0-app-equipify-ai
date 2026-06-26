/**
 * GE-AIOS-GROWTH-5C — Autonomous Qualification Agent Pilot certification.
 * Run: pnpm test:ge-aios-growth-5c-autonomous-qualification-agent
 */
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_AGENT_KINDS } from "../lib/growth/aios/growth/growth-agent-framework-types"
import {
  applyQualificationPilotControlTransition,
  buildAutonomousQualificationPilotPlanContext,
  buildAutonomousQualificationPilotReadModel,
  buildAutonomousQualificationRunRecord,
  buildResearchResultFromWorkflowSnapshot,
  enforceQualificationAgentBudget,
  evaluateAutonomousQualificationDecision,
  evaluateQualificationMemoryReadiness,
  evaluateQualificationWakeCondition,
  isLeadInQualificationFailureCooldown,
  isQualificationAgentSchedulerActive,
  selectQualificationWakeCandidates,
} from "../lib/growth/aios/growth/growth-autonomous-qualification-pilot-engine"
import {
  GROWTH_AUTONOMOUS_QUALIFICATION_COMPLETED_EVENT,
  GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_AGENT,
  GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_BUDGET,
  GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_QA_MARKER,
  GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_RULE,
  GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_SCHEDULER_MODE,
  GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_WAKE_CONDITIONS,
} from "../lib/growth/aios/growth/growth-autonomous-qualification-pilot-types"
import {
  appendAutonomousQualificationRun,
  resetAutonomousQualificationPilotOrgState,
  setAutonomousQualificationPilotControlState,
} from "../lib/growth/aios/growth/growth-autonomous-qualification-pilot-store"
import {
  buildGrowthAiOsAutonomyPolicyReadModel,
  evaluateQualificationPilotAutonomyPolicyGate,
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

const ORG = "org-cert-5c"
const GENERATED_AT = "2026-06-25T14:00:00.000Z"
const LEAD = "lead-cert-5c"

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

console.log("[GE-AIOS-GROWTH-5C] Autonomous Qualification Agent Pilot certification")

assert.equal(GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_QA_MARKER, "growth-aios-growth-5c-autonomous-qualification-pilot-v1")
assert.match(GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_RULE, /Qualification Agent|no outbound/i)
assert.equal(GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_AGENT, "qualification_agent")
assert.equal(GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_SCHEDULER_MODE, "controlled_agent_wake")
assert.equal(GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_WAKE_CONDITIONS.length, 3)
assert.equal(GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_BUDGET.maxRunsPerHour, 20)
assert.equal(GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_BUDGET.maxRunsPerDay, 200)
assert.equal(GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_BUDGET.maxRetriesPerLeadPerDay, 3)
assert.equal(GROWTH_AUTONOMOUS_QUALIFICATION_COMPLETED_EVENT, "growth.qualification.completed")
console.log("  ✓ QA marker and pilot constants")

assertNoForbiddenPaths("lib/growth/aios/growth/growth-autonomous-qualification-pilot-types.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-autonomous-qualification-pilot-engine.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-autonomous-qualification-pilot-store.ts")
console.log("  ✓ No forbidden side-effect tokens in engine/types/store")

const serviceSource = readSource("lib/growth/aios/growth/growth-autonomous-qualification-pilot-service.ts")
assert.equal(serviceSource.includes("invokeAiOsProvider"), false)
assert.equal(serviceSource.includes("enqueueRuntime"), false)
assert.equal(serviceSource.includes("createAiWorkOrder"), false)
assert.match(serviceSource, /fetchGrowthAiOsAutonomyPolicyEvaluationContext/)
assert.match(serviceSource, /evaluateQualificationPilotAutonomyPolicyGate/)
assert.match(serviceSource, /GROWTH_AUTONOMOUS_QUALIFICATION_COMPLETED_EVENT/)
const engineSource = readSource("lib/growth/aios/growth/growth-autonomous-qualification-pilot-engine.ts")
assert.match(engineSource, /qualifyGrowthLeadResearch/)
console.log("  ✓ Pilot cycle consults policy evaluation context and wraps qualification logic")

const actionRoute = readSource("app/api/platform/growth/ai-os/autonomous-qualification-pilot/action/route.ts")
assert.match(actionRoute, /403/)
assert.match(actionRoute, /policy_control_plane_required/)
console.log("  ✓ Legacy action API policy-gated")

const commandCenterUi = readSource(
  "components/growth/ai-os/command-center/growth-ai-os-autonomous-qualification-pilot-section.tsx",
)
assert.match(commandCenterUi, /Autonomous Qualification Agent/)
assert.match(commandCenterUi, /Configure in Growth Autonomy/)
assert.equal(commandCenterUi.includes("onAction"), false)
console.log("  ✓ Command Center pilot section read-only with Growth Autonomy deep link")

const missionPlanning = readSource("lib/growth/aios/ai-executive-mission-planning-review-service.ts")
assert.match(missionPlanning, /buildGrowthAutonomousQualificationPilotPlanContext/)
assert.match(missionPlanning, /autonomousQualificationPilotContext/)

const missionPlanningUi = readSource(
  "components/growth/ai-os/growth/growth-ai-os-lead-research-execution-plan-section.tsx",
)
assert.match(missionPlanningUi, /autonomous-qualification-pilot-context/)
console.log("  ✓ Mission Planning Review qualification context")

assert.equal(evaluateQualificationMemoryReadiness(null).sufficient, false)
assert.equal(evaluateQualificationMemoryReadiness(researchCompleteSnapshot).sufficient, true)
assert.equal(
  evaluateQualificationWakeCondition({
    leadId: LEAD,
    snapshot: researchCompleteSnapshot,
    runs: [],
    generatedAt: GENERATED_AT,
  }),
  "research_completed",
)
assert.equal(
  evaluateQualificationWakeCondition({
    leadId: LEAD,
    snapshot: null,
    runs: [],
    generatedAt: GENERATED_AT,
  }),
  null,
)
console.log("  ✓ Wake conditions and missing research blocks")

const schedulerWakeRules = buildSchedulerWakeRules()
const qualificationWake = schedulerWakeRules.find((rule) => rule.agentKind === "qualification_agent")
const researchWake = schedulerWakeRules.find((rule) => rule.agentKind === "research_agent")
assert.ok(qualificationWake)
assert.ok(researchWake)
assert.ok(qualificationWake!.allowedSchedulerModes.includes("controlled_agent_wake"))
assert.ok(researchWake!.allowedSchedulerModes.includes("controlled_agent_wake"))
for (const kind of GROWTH_AGENT_KINDS) {
  if (
    kind === "research_agent" ||
    kind === "qualification_agent" ||
    kind === "planning_agent" ||
    kind === "execution_agent"
  ) {
    continue
  }
  const rule = schedulerWakeRules.find((row) => row.agentKind === kind)
  assert.equal(rule?.wakeAllowedInPhase, false)
}
console.log("  ✓ Research, Qualification, Planning, and Execution agents may wake; others remain disabled")

resetAutonomousQualificationPilotOrgState(ORG)
assert.equal(isQualificationAgentSchedulerActive("disabled"), false)
assert.equal(isQualificationAgentSchedulerActive("active"), true)

let control = applyQualificationPilotControlTransition({ current: "disabled", action: "resume" })
assert.equal(control, "active")
control = applyQualificationPilotControlTransition({ current: "active", action: "disable" })
assert.equal(control, "disabled")
setAutonomousQualificationPilotControlState({ organizationId: ORG, controlState: control, now: GENERATED_AT })
console.log("  ✓ Control transitions")

const runs = Array.from({ length: 20 }, (_, index) =>
  buildAutonomousQualificationRunRecord({
    leadId: `lead-${index}`,
    companyName: "Cert Co",
    wakeCondition: "research_completed",
    generatedAt: new Date(Date.parse(GENERATED_AT) - index * 60_000).toISOString(),
    outcome: "completed",
    decision: evaluateAutonomousQualificationDecision({
      snapshot: researchCompleteSnapshot,
      companyName: "Cert Co",
    }),
  }),
)
const budgetBlocked = enforceQualificationAgentBudget({ runs, generatedAt: GENERATED_AT })
assert.equal(budgetBlocked.allowed, false)
console.log("  ✓ Hourly budget limits enforced")

const failedRun = buildAutonomousQualificationRunRecord({
  leadId: LEAD,
  companyName: "Cert Co",
  wakeCondition: "research_completed",
  generatedAt: new Date(Date.parse(GENERATED_AT) - 5 * 60_000).toISOString(),
  outcome: "failed",
})
assert.equal(
  isLeadInQualificationFailureCooldown({
    runs: [failedRun],
    leadId: LEAD,
    generatedAt: GENERATED_AT,
  }),
  true,
)
console.log("  ✓ Failure cooldown enforced")

const readModel = buildAutonomousQualificationPilotReadModel({
  controlState: "active",
  runs,
  generatedAt: GENERATED_AT,
  eligibleLeads: 2,
})
const readModel2 = buildAutonomousQualificationPilotReadModel({
  controlState: "active",
  runs,
  generatedAt: GENERATED_AT,
  eligibleLeads: 2,
})
assert.equal(JSON.stringify(readModel), JSON.stringify(readModel2))
assert.deepEqual(readModel.disabledAgentKinds, [
  "outreach_agent",
  "meeting_agent",
])
assert.ok(readModel.revenueOperatorSupervision.latestHandoffRecommendation)
console.log("  ✓ Deterministic read model and Revenue Operator handoff")

const decision = evaluateAutonomousQualificationDecision({
  snapshot: researchCompleteSnapshot,
  companyName: "Cert Co",
})
assert.ok(decision.qualification.fitScore >= 0)
assert.ok(decision.revenueOperatorHandoff.length > 0)
assert.ok(buildResearchResultFromWorkflowSnapshot({ snapshot: researchCompleteSnapshot, companyName: "Cert Co" }).companySummary.length > 0)
console.log("  ✓ Qualification engine wraps existing services")

const settings = buildDefaultGrowthAutonomySettings(ORG)
settings.masterMode = "assisted"
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
assert.equal(evaluateQualificationPilotAutonomyPolicyGate({ policy: allowedPolicy, settings }).allowed, true)

settings.capabilityToggles.enrichment = false
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
assert.equal(evaluateQualificationPilotAutonomyPolicyGate({ policy: blockedPolicy, settings }).allowed, false)
console.log("  ✓ Policy engine gate blocks disabled enrichment capability")

const missions = deriveMissionsForLead({
  leadId: LEAD,
  companyName: "Cert Co",
  workflowType: "research_company",
  workflowStatus: "research_complete",
  researchSummary: "Research complete",
  qualificationSummary: null,
  opportunityAssessment: null,
  nextBestAction: "Qualify lead",
  approvalState: "approved_for_future_execution",
  readinessState: "ready_for_future_execution",
  runtimeState: null,
  dryRunState: "dry_run_passed",
  owningAgent: "qualification_agent",
  revenueOperatorRecommendation: "Qualify after research",
  blockedReasons: [],
  humanReviewRequirements: [],
  confidence: 0.7,
  completenessState: "missing_qualification",
  orchestrationDecision: "handoff_to_qualification",
  outboundRecommended: false,
  lastUpdatedAt: GENERATED_AT,
  generatedAt: GENERATED_AT,
})
const allocation = prioritizeAndAllocateMissions({ missions, generatedAt: GENERATED_AT })
const candidates = selectQualificationWakeCandidates({ rankedMissions: allocation.rankedMissions })
assert.ok(candidates.length >= 1)
console.log("  ✓ Qualification wake candidates from priority queue")

const planContext = buildAutonomousQualificationPilotPlanContext({
  leadId: LEAD,
  snapshot: researchCompleteSnapshot,
  controlState: "active",
  runs: [],
  generatedAt: GENERATED_AT,
})
assert.equal(planContext.qualificationAgentOwner, "qualification_agent")
assert.equal(planContext.qualificationStatus, "pending")
console.log("  ✓ Mission planning qualification context")

for (const run of runs.slice(0, 3)) {
  appendAutonomousQualificationRun({ organizationId: ORG, run, now: GENERATED_AT })
}
const duplicateBlocked = enforceQualificationAgentBudget({
  runs: [
    ...runs,
    buildAutonomousQualificationRunRecord({
      leadId: LEAD,
      companyName: "Cert Co",
      wakeCondition: "research_completed",
      generatedAt: GENERATED_AT,
      outcome: "completed",
      decision,
    }),
    buildAutonomousQualificationRunRecord({
      leadId: LEAD,
      companyName: "Cert Co",
      wakeCondition: "research_completed",
      generatedAt: GENERATED_AT,
      outcome: "completed",
      decision,
    }),
    buildAutonomousQualificationRunRecord({
      leadId: LEAD,
      companyName: "Cert Co",
      wakeCondition: "research_completed",
      generatedAt: GENERATED_AT,
      outcome: "completed",
      decision,
    }),
  ],
  generatedAt: GENERATED_AT,
  leadId: LEAD,
})
assert.equal(duplicateBlocked.allowed, false)
console.log("  ✓ Per-lead retry budget enforced")

console.log("[GE-AIOS-GROWTH-5C] Running 5B regression…")
const regression5b = spawnSync("pnpm", ["test:ge-aios-growth-5b-autonomous-research-agent"], {
  stdio: "inherit",
  shell: true,
})
assert.equal(regression5b.status, 0, "5B regression failed")

console.log("[GE-AIOS-GROWTH-5C] PASS — Autonomous Qualification Agent Pilot certified")
