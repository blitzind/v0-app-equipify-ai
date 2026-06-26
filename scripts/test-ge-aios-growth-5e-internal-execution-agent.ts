/**
 * GE-AIOS-GROWTH-5E — Internal Execution Agent Pilot certification.
 * Run: pnpm test:ge-aios-growth-5e-internal-execution-agent
 */
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_AGENT_KINDS } from "../lib/growth/aios/growth/growth-agent-framework-types"
import {
  applyExecutionPilotControlTransition,
  buildAutonomousExecutionPilotPlanContext,
  buildAutonomousExecutionPilotReadModel,
  buildAutonomousExecutionRunRecord,
  buildOperationsExecutionAgentStatus,
  enforceExecutionAgentBudget,
  evaluateExecutionGateReadiness,
  evaluateExecutionWakeCondition,
  isExecutionAgentSchedulerActive,
  isOutboundWorkflowBlocked,
} from "../lib/growth/aios/growth/growth-autonomous-execution-pilot-engine"
import {
  appendAutonomousExecutionRun,
  resetAutonomousExecutionPilotOrgState,
  setAutonomousExecutionPilotControlState,
} from "../lib/growth/aios/growth/growth-autonomous-execution-pilot-store"
import {
  GROWTH_AUTONOMOUS_EXECUTION_ENQUEUED_EVENT,
  GROWTH_AUTONOMOUS_EXECUTION_PILOT_AGENT,
  GROWTH_AUTONOMOUS_EXECUTION_PILOT_ALLOWED_WORKFLOW,
  GROWTH_AUTONOMOUS_EXECUTION_PILOT_BUDGET,
  GROWTH_AUTONOMOUS_EXECUTION_PILOT_QA_MARKER,
  GROWTH_AUTONOMOUS_EXECUTION_PILOT_RULE,
  GROWTH_AUTONOMOUS_EXECUTION_PILOT_SCHEDULER_MODE,
  GROWTH_AUTONOMOUS_EXECUTION_PILOT_WAKE_CONDITIONS,
} from "../lib/growth/aios/growth/growth-autonomous-execution-pilot-types"
import {
  buildGrowthAiOsAutonomyPolicyReadModel,
  evaluateExecutionPilotAutonomyPolicyGate,
} from "../lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"
import { buildDefaultGrowthAutonomySettings } from "../lib/growth/autonomy/growth-autonomy-config"
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
    "startWorkflow",
  ]) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

const ORG = "org-cert-5e"
const GENERATED_AT = "2026-06-25T16:00:00.000Z"
const LEAD = "lead-cert-5e"
const PLAN_ID = "plan-cert-5e"

console.log("[GE-AIOS-GROWTH-5E] Internal Execution Agent Pilot certification")

assert.equal(GROWTH_AUTONOMOUS_EXECUTION_PILOT_QA_MARKER, "growth-aios-growth-5e-autonomous-execution-pilot-v1")
assert.match(GROWTH_AUTONOMOUS_EXECUTION_PILOT_RULE, /Execution Agent|research_company|No outbound/i)
assert.equal(GROWTH_AUTONOMOUS_EXECUTION_PILOT_AGENT, "execution_agent")
assert.equal(GROWTH_AUTONOMOUS_EXECUTION_PILOT_SCHEDULER_MODE, "controlled_agent_wake")
assert.equal(GROWTH_AUTONOMOUS_EXECUTION_PILOT_ALLOWED_WORKFLOW, "research_company")
assert.equal(GROWTH_AUTONOMOUS_EXECUTION_PILOT_WAKE_CONDITIONS.length, 4)
assert.equal(GROWTH_AUTONOMOUS_EXECUTION_PILOT_BUDGET.maxRunsPerHour, 5)
assert.equal(GROWTH_AUTONOMOUS_EXECUTION_PILOT_BUDGET.maxRunsPerDay, 25)
assert.equal(GROWTH_AUTONOMOUS_EXECUTION_PILOT_BUDGET.maxRetriesPerPlanPerDay, 2)
assert.equal(GROWTH_AUTONOMOUS_EXECUTION_PILOT_BUDGET.cooldownAfterFailureMinutes, 30)
assert.equal(GROWTH_AUTONOMOUS_EXECUTION_ENQUEUED_EVENT, "growth.execution.enqueued")
console.log("  ✓ QA marker and pilot constants")

assertNoForbiddenPaths("lib/growth/aios/growth/growth-autonomous-execution-pilot-types.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-autonomous-execution-pilot-engine.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-autonomous-execution-pilot-store.ts")
console.log("  ✓ No forbidden side-effect tokens in engine/types/store")

const serviceSource = readSource("lib/growth/aios/growth/growth-autonomous-execution-pilot-service.ts")
assert.equal(serviceSource.includes("invokeAiOsProvider"), false)
assert.equal(serviceSource.includes("createAiWorkOrder"), false)
assert.match(serviceSource, /fetchGrowthAiOsAutonomyPolicyEvaluationContext/)
assert.match(serviceSource, /evaluateExecutionPilotAutonomyPolicyGate/)
assert.match(serviceSource, /enqueueGrowthLeadResearchExecution/)
assert.match(serviceSource, /validateGrowthLeadResearchExecutionPilotEnqueue/)
assert.match(serviceSource, /GROWTH_AUTONOMOUS_EXECUTION_ENQUEUED_EVENT/)
assert.match(serviceSource, /policyDerivedFlags/)
console.log("  ✓ Pilot cycle consults policy evaluation context and existing runtime enqueue path")

const runtimePilotSource = readSource("lib/growth/aios/growth/growth-lead-research-execution-runtime-pilot-service.ts")
assert.match(runtimePilotSource, /policyDerivedFlags/)
assert.match(runtimePilotSource, /runtimeOverride: input\.policyDerivedFlags \? undefined/)
console.log("  ✓ Runtime pilot honors policy-derived flags without request-body overrides")

const actionRoute = readSource("app/api/platform/growth/ai-os/autonomous-execution-pilot/action/route.ts")
assert.match(actionRoute, /403/)
assert.match(actionRoute, /policy_control_plane_required/)
console.log("  ✓ Legacy action API policy-gated")

const operationsUi = readSource("components/growth/ai-os/operations/growth-ai-os-operations-dashboard.tsx")
assert.match(operationsUi, /Execution Agent/)
assert.match(operationsUi, /executionAgentStatus/)
assert.equal(operationsUi.includes("autonomous-execution-pilot-section"), false)
console.log("  ✓ AI Operations compact Execution Agent status (no large engineering section)")

const missionPlanning = readSource("lib/growth/aios/ai-executive-mission-planning-review-service.ts")
assert.match(missionPlanning, /buildGrowthAutonomousExecutionPilotPlanContext/)
assert.match(missionPlanning, /autonomousExecutionPilotContext/)

const missionPlanningUi = readSource(
  "components/growth/ai-os/growth/growth-ai-os-lead-research-execution-plan-section.tsx",
)
assert.match(missionPlanningUi, /autonomous-execution-pilot-context/)
console.log("  ✓ Mission Planning Review execution context")

assert.equal(isOutboundWorkflowBlocked("research_company"), false)
assert.equal(isOutboundWorkflowBlocked("outreach_generation"), true)
assert.equal(isOutboundWorkflowBlocked("verify_email"), true)
console.log("  ✓ Outbound workflows blocked; research_company allowlisted")

const gateReady = evaluateExecutionGateReadiness({
  workflowType: "research_company",
  approvalState: "approved_for_future_execution",
  readinessState: "ready_for_future_execution",
  handoffState: "handoff_ready",
  preflightStatus: "preflight_passed",
  dryRunStatus: "dry_run_passed",
  enqueueAllowed: true,
  blockReason: null,
})
assert.equal(gateReady.eligible, true)

const gateMissingDryRun = evaluateExecutionGateReadiness({
  workflowType: "research_company",
  approvalState: "approved_for_future_execution",
  readinessState: "ready_for_future_execution",
  handoffState: "handoff_ready",
  preflightStatus: "preflight_passed",
  dryRunStatus: null,
  enqueueAllowed: true,
  blockReason: null,
})
assert.equal(gateMissingDryRun.eligible, false)
assert.match(gateMissingDryRun.blockReason ?? "", /Dry-run required/i)
console.log("  ✓ Dry-run required before enqueue")

const schedulerWakeRules = buildSchedulerWakeRules()
const executionWake = schedulerWakeRules.find((rule) => rule.agentKind === "execution_agent")
const planningWake = schedulerWakeRules.find((rule) => rule.agentKind === "planning_agent")
const qualificationWake = schedulerWakeRules.find((rule) => rule.agentKind === "qualification_agent")
const researchWake = schedulerWakeRules.find((rule) => rule.agentKind === "research_agent")
assert.ok(executionWake)
assert.ok(planningWake)
assert.ok(qualificationWake)
assert.ok(researchWake)
assert.ok(executionWake!.allowedSchedulerModes.includes("controlled_agent_wake"))
assert.ok(executionWake!.wakeAllowedInPhase)
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
console.log("  ✓ Research, Qualification, Planning, and Execution agents may wake; Outreach/Meeting remain disabled")

resetAutonomousExecutionPilotOrgState(ORG)
assert.equal(isExecutionAgentSchedulerActive("disabled"), false)
assert.equal(isExecutionAgentSchedulerActive("active"), true)

let control = applyExecutionPilotControlTransition({ current: "disabled", action: "resume" })
assert.equal(control, "active")
control = applyExecutionPilotControlTransition({ current: "active", action: "disable" })
assert.equal(control, "disabled")
setAutonomousExecutionPilotControlState({ organizationId: ORG, controlState: control, now: GENERATED_AT })
console.log("  ✓ Control transitions")

const runs = Array.from({ length: 5 }, (_, index) =>
  buildAutonomousExecutionRunRecord({
    leadId: `lead-${index}`,
    companyName: "Cert Co",
    planId: `${PLAN_ID}-${index}`,
    wakeCondition: "execution_plan_ready",
    generatedAt: new Date(Date.parse(GENERATED_AT) - index * 60_000).toISOString(),
    outcome: "completed",
    executionId: `exec-${index}`,
    workflowType: "research_company",
    runtimeState: "completed",
    revenueOperatorHandoff: "report_outcome_to_revenue_operator",
  }),
)
const budgetBlocked = enforceExecutionAgentBudget({ runs, generatedAt: GENERATED_AT })
assert.equal(budgetBlocked.allowed, false)
console.log("  ✓ Hourly budget limits enforced (5/hr)")

const failedRun = buildAutonomousExecutionRunRecord({
  leadId: LEAD,
  companyName: "Cert Co",
  planId: PLAN_ID,
  wakeCondition: "execution_plan_ready",
  generatedAt: new Date(Date.parse(GENERATED_AT) - 5 * 60_000).toISOString(),
  outcome: "failed",
})
const cooldownBlocked = enforceExecutionAgentBudget({
  runs: [failedRun],
  generatedAt: GENERATED_AT,
  planId: PLAN_ID,
})
assert.equal(cooldownBlocked.allowed, false)
assert.match(cooldownBlocked.skipReason ?? "", /Cooldown active/i)
console.log("  ✓ Failure cooldown enforced")

const readModel = buildAutonomousExecutionPilotReadModel({
  controlState: "active",
  runs,
  generatedAt: GENERATED_AT,
  eligiblePlans: 2,
  queuedExecutions: 1,
  activeExecutions: 1,
})
const readModel2 = buildAutonomousExecutionPilotReadModel({
  controlState: "active",
  runs,
  generatedAt: GENERATED_AT,
  eligiblePlans: 2,
  queuedExecutions: 1,
  activeExecutions: 1,
})
assert.equal(JSON.stringify(readModel), JSON.stringify(readModel2))
assert.deepEqual(readModel.disabledAgentKinds, ["outreach_agent", "meeting_agent"])
assert.ok(readModel.revenueOperatorSupervision.latestOutcomeRecommendation !== undefined)
const opsStatus = buildOperationsExecutionAgentStatus({
  pilot: readModel,
  configureHref: "/growth/settings/autonomy",
})
assert.equal(opsStatus.eligiblePlans, 2)
assert.match(opsStatus.budgetLabel, /5/)
console.log("  ✓ Deterministic read model and operations status")

const wakeCondition = evaluateExecutionWakeCondition({
  planId: PLAN_ID,
  leadId: LEAD,
  runs: [],
  generatedAt: GENERATED_AT,
  gateReadiness: gateReady,
})
assert.equal(wakeCondition, "execution_plan_ready")
console.log("  ✓ Wake condition when gates pass")

const planContext = buildAutonomousExecutionPilotPlanContext({
  planId: PLAN_ID,
  leadId: LEAD,
  executionPlan: {
    workflowType: "research_company",
    nextBestAction: "Run research",
    estimatedDuration: "5m",
    estimatedCost: "low",
    expectedOutcome: "Updated research",
    estimatedSteps: [],
    requiredWorkOrders: [],
  },
  approvalState: "approved_for_future_execution",
  readinessState: "ready_for_future_execution",
  handoffState: "handoff_ready",
  preflightStatus: "preflight_passed",
  dryRunStatus: "dry_run_passed",
  enqueueAllowed: true,
  blockReason: null,
  controlState: "active",
  runs: [],
  runtimeState: null,
  generatedAt: GENERATED_AT,
})
assert.equal(planContext.executionAgentOwner, "execution_agent")
assert.equal(planContext.executionEligible, true)
assert.equal(planContext.dryRunRequired, true)
console.log("  ✓ Mission planning execution context")

const settings = buildDefaultGrowthAutonomySettings(ORG)
settings.masterMode = "assisted"
settings.capabilityToggles.recommendations = true
settings.capabilityToggles.enrichment = true
settings.capabilityToggles.research = true
settings.capabilityToggles.task_creation = true
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
  runtimeEnabled: true,
  runtimePilotEnabled: true,
})
assert.equal(
  evaluateExecutionPilotAutonomyPolicyGate({ policy: allowedPolicy, settings }).allowed,
  true,
)
assert.equal(allowedPolicy.executionAutonomyEnabled, true)
assert.ok(allowedPolicy.activeAutonomousAgents.includes("execution_agent"))

settings.capabilityToggles.task_creation = false
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
  runtimeEnabled: true,
  runtimePilotEnabled: true,
})
assert.equal(
  evaluateExecutionPilotAutonomyPolicyGate({ policy: blockedPolicy, settings }).allowed,
  false,
)
console.log("  ✓ Policy engine gate blocks disabled task_creation capability")

const retryRuns = [
  buildAutonomousExecutionRunRecord({
    leadId: LEAD,
    companyName: "Cert Co",
    planId: PLAN_ID,
    wakeCondition: "execution_plan_ready",
    generatedAt: new Date(Date.parse(GENERATED_AT) - 2 * 60 * 60_000).toISOString(),
    outcome: "failed",
  }),
  buildAutonomousExecutionRunRecord({
    leadId: LEAD,
    companyName: "Cert Co",
    planId: PLAN_ID,
    wakeCondition: "stale_runtime_retry",
    generatedAt: new Date(Date.parse(GENERATED_AT) - 60 * 60_000).toISOString(),
    outcome: "completed",
  }),
]
const retryBlocked = enforceExecutionAgentBudget({
  runs: retryRuns,
  generatedAt: GENERATED_AT,
  planId: PLAN_ID,
})
assert.equal(retryBlocked.allowed, false)
assert.match(retryBlocked.skipReason ?? "", /retry limit/i)
console.log("  ✓ Per-plan retry budget enforced")

console.log("[GE-AIOS-GROWTH-5E] Running 5D regression…")
const regression5d = spawnSync("pnpm", ["test:ge-aios-growth-5d-autonomous-planning-agent"], {
  stdio: "inherit",
  shell: true,
})
assert.equal(regression5d.status, 0, "5D regression failed")

console.log("[GE-AIOS-GROWTH-5E] Internal Execution Agent Pilot certification PASSED")
