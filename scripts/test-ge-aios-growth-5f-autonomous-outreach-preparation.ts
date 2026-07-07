/**
 * GE-AIOS-GROWTH-5F — Autonomous Outreach Preparation Agent certification.
 * Run: pnpm test:ge-aios-growth-5f-autonomous-outreach-preparation
 */
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_AGENT_KINDS } from "../lib/growth/aios/growth/growth-agent-framework-types"
import type { GrowthAutonomousExecutionRunRecord } from "../lib/growth/aios/growth/growth-autonomous-execution-pilot-types"
import {
  applyOutreachPreparationPilotControlTransition,
  buildAutonomousOutreachPreparationPilotPlanContext,
  buildAutonomousOutreachPreparationPilotReadModel,
  buildAutonomousOutreachPreparationRunRecord,
  buildOperationsOutreachAgentStatus,
  enforceOutreachPreparationAgentBudget,
  evaluateOutreachMemoryReadiness,
  evaluateOutreachPreparationGateReadiness,
  evaluateOutreachPreparationWakeCondition,
  hasCompletedInternalExecution,
  isOutreachPreparationAgentSchedulerActive,
  summarizePreparedAssetsForPackage,
} from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-engine"
import {
  GROWTH_AUTONOMOUS_OUTREACH_PREPARED_EVENT,
  GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_AGENT,
  GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_BUDGET,
  GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_MIN_CONFIDENCE,
  GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_QA_MARKER,
  GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_RULE,
  GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_SCHEDULER_MODE,
  GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_WAKE_CONDITIONS,
} from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import {
  buildGrowthAiOsAutonomyPolicyReadModel,
  evaluateOutreachPreparationPilotAutonomyPolicyGate,
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
    "executeTransportSend",
    "sendEmail",
    "sendSms",
    "execute-outreach",
    "sequence-send-builder",
    "cron.schedule",
    "setInterval",
    "startWorkflow",
  ]) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

const ORG = "org-cert-5f"
const GENERATED_AT = "2026-06-25T17:00:00.000Z"
const LEAD = "lead-cert-5f"

const executionCompleteRun: GrowthAutonomousExecutionRunRecord = {
  runId: "exec-run-1",
  leadId: LEAD,
  companyName: "Cert Co",
  planId: "plan-1",
  wakeCondition: "execution_plan_ready",
  outcome: "completed",
  startedAt: GENERATED_AT,
  completedAt: GENERATED_AT,
  durationMs: 1000,
  executionId: "exec-1",
  workflowType: "research_company",
  runtimeState: "completed",
  skipReason: null,
  blockReason: null,
  dryRunStatus: "dry_run_passed",
  revenueOperatorHandoff: "report_outcome_to_revenue_operator",
}

const readySnapshot = {
  workflowKey: "growth_lead_research" as const,
  workflowStatus: "assessed" as const,
  leadId: LEAD,
  researchRunId: "research-1",
  missionId: "mission-1",
  companyName: "Cert Co",
  qualification: { fitScore: 72, confidence: 0.7, recommendedNextAction: "Prepare outreach", reason: "Qualified" },
  executionPlan: {
    workflowType: "research_company" as const,
    nextBestAction: "Prepare outreach",
    estimatedDuration: "1d",
    estimatedCost: "low",
    expectedOutcome: "Human-approved outreach",
    estimatedSteps: [],
    requiredWorkOrders: [],
    prerequisites: [],
    missingPrerequisites: [],
    executionReadiness: "ready_for_future_execution" as const,
  },
  opportunityAssessment: { confidence: 0.7, fitScore: 72, summary: "Strong fit" },
  evidenceSummary: { verifiedEvidence: ["Company summary: Cert Co"] },
  updatedAt: GENERATED_AT,
}

console.log("[GE-AIOS-GROWTH-5F] Autonomous Outreach Preparation Agent certification")

assert.equal(GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_QA_MARKER, "growth-aios-growth-5f-autonomous-outreach-preparation-pilot-v1")
assert.match(GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_RULE, /Outreach Agent|draft-only|No transport/i)
assert.equal(GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_AGENT, "outreach_agent")
assert.equal(GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_SCHEDULER_MODE, "controlled_agent_wake")
assert.equal(GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_WAKE_CONDITIONS.length, 3)
assert.equal(GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_BUDGET.maxRunsPerHour, 20)
assert.equal(GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_BUDGET.maxRunsPerDay, 200)
assert.equal(GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_BUDGET.maxRetriesPerLeadPerDay, 3)
assert.equal(GROWTH_AUTONOMOUS_OUTREACH_PREPARED_EVENT, "growth.outreach.prepared")
console.log("  ✓ QA marker and pilot constants")

assertNoForbiddenPaths("lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-engine.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store.ts")
console.log("  ✓ No forbidden side-effect tokens in engine/types/store")

const serviceSource = readSource("lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-service.ts")
const draftSource = readSource("lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service.ts")
assert.match(serviceSource, /fetchGrowthAiOsAutonomyPolicyEvaluationContext/)
assert.match(serviceSource, /evaluateOutreachPreparationPilotAutonomyPolicyGate/)
assert.match(serviceSource, /GROWTH_AUTONOMOUS_OUTREACH_PREPARED_EVENT/)
assert.match(draftSource, /runOutreachPersonalizationGeneration/)
assert.match(draftSource, /runSmsPersonalizationForLead/)
assert.match(draftSource, /buildCadenceLinkedInDraft/)
assert.match(draftSource, /previewSendrPersonalization/)
assert.equal(draftSource.includes("sendEmail"), false)
assert.equal(draftSource.includes("executeTransportSend"), false)
console.log("  ✓ Reuses existing SENDR/personalization draft systems without transport")

const actionRoute = readSource("app/api/platform/growth/ai-os/autonomous-outreach-preparation-pilot/action/route.ts")
assert.match(actionRoute, /403/)
console.log("  ✓ Legacy action API policy-gated")

const operationsUi = readSource("components/growth/ai-os/operations/growth-ai-os-operations-dashboard.tsx")
assert.match(operationsUi, /Outreach Agent/)
assert.match(operationsUi, /outreachAgentStatus/)
console.log("  ✓ AI Operations compact Outreach Agent status")

const missionPlanning = readSource("lib/growth/aios/ai-executive-mission-planning-review-service.ts")
assert.match(missionPlanning, /buildGrowthAutonomousOutreachPreparationPilotPlanContext/)
console.log("  ✓ Mission Planning Review outreach context")

assert.equal(hasCompletedInternalExecution({ executionRuns: [executionCompleteRun], leadId: LEAD }), true)
assert.equal(evaluateOutreachMemoryReadiness(readySnapshot).sufficient, true)
assert.equal(evaluateOutreachMemoryReadiness(null).sufficient, false)

const gateReady = evaluateOutreachPreparationGateReadiness({
  snapshot: readySnapshot,
  executionRuns: [executionCompleteRun],
  leadId: LEAD,
  confidence: 0.7,
})
assert.equal(gateReady.eligible, true)

const gateNoExecution = evaluateOutreachPreparationGateReadiness({
  snapshot: readySnapshot,
  executionRuns: [],
  leadId: LEAD,
  confidence: 0.7,
})
assert.equal(gateNoExecution.eligible, false)

const gateLowConfidence = evaluateOutreachPreparationGateReadiness({
  snapshot: readySnapshot,
  executionRuns: [executionCompleteRun],
  leadId: LEAD,
  confidence: 0.2,
})
assert.equal(gateLowConfidence.eligible, false)
assert.match(gateLowConfidence.blockReason ?? "", /Confidence below threshold/)
console.log("  ✓ Wake requires successful internal execution and confidence threshold")

const schedulerWakeRules = buildSchedulerWakeRules()
const outreachWake = schedulerWakeRules.find((rule) => rule.agentKind === "outreach_agent")
const meetingWake = schedulerWakeRules.find((rule) => rule.agentKind === "meeting_agent")
assert.ok(outreachWake)
assert.ok(meetingWake)
assert.ok(outreachWake!.wakeAllowedInPhase)
assert.ok(meetingWake!.wakeAllowedInPhase)
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
console.log("  ✓ Outreach and Meeting Agent may wake in pilot phase")

assert.equal(isOutreachPreparationAgentSchedulerActive("disabled"), false)
assert.equal(isOutreachPreparationAgentSchedulerActive("active"), true)

const runs = Array.from({ length: 20 }, (_, index) =>
  buildAutonomousOutreachPreparationRunRecord({
    leadId: `lead-${index}`,
    companyName: "Cert Co",
    wakeCondition: "execution_completed",
    generatedAt: new Date(Date.parse(GENERATED_AT) - index * 60_000).toISOString(),
    outcome: "completed",
    approvalPackage: {
      packageId: `pkg-${index}`,
      leadId: `lead-${index}`,
      companyName: "Cert Co",
      preparedAt: GENERATED_AT,
      generatedAssets: summarizePreparedAssetsForPackage({
        emailSubject: "Hello",
        emailBody: "Body",
        smsBody: "SMS",
        linkedInDraft: "LinkedIn",
        callTalkingPoints: "Call",
        sendrRecommendation: "SENDR",
        followUpRecommendation: "Follow up",
      }),
      personalizationEvidence: [],
      supportingResearch: [],
      confidence: 0.7,
      approvalRequirements: ["operator_outbound_approval"],
      complianceNotes: ["draft-only"],
      recommendedChannel: "email",
      recommendedSequence: "email_first",
      expectedOutcome: "Approval",
      pendingHumanApproval: true,
      transportBlocked: true,
    },
  }),
)
const budgetBlocked = enforceOutreachPreparationAgentBudget({ runs, generatedAt: GENERATED_AT })
assert.equal(budgetBlocked.allowed, false)
console.log("  ✓ Hourly budget limits enforced (20/hr)")

const assets = summarizePreparedAssetsForPackage({
  emailSubject: "Quick intro",
  emailBody: "Email body draft",
  smsBody: "SMS draft",
  linkedInDraft: "LinkedIn draft",
  callTalkingPoints: "Talking points",
  sendrRecommendation: "SENDR vars resolved",
  followUpRecommendation: "Follow up in 3 days",
})
assert.equal(assets.length, 6)
assert.ok(assets.every((asset) => asset.draftOnly))
console.log("  ✓ Approval package asset summaries generated")

const readModel = buildAutonomousOutreachPreparationPilotReadModel({
  controlState: "active",
  runs,
  generatedAt: GENERATED_AT,
  eligibleLeads: 2,
})
assert.deepEqual(readModel.disabledAgentKinds, ["meeting_agent"])
assert.equal(readModel.preparationModeOnly, true)
const opsStatus = buildOperationsOutreachAgentStatus({
  pilot: readModel,
  configureHref: "/growth/settings/autonomy",
})
assert.ok(opsStatus.draftsPrepared >= 6)
console.log("  ✓ Deterministic read model and operations status")

const wakeCondition = evaluateOutreachPreparationWakeCondition({
  leadId: LEAD,
  runs: [],
  generatedAt: GENERATED_AT,
  gateReadiness: gateReady,
})
assert.equal(wakeCondition, "execution_completed")

const planContext = buildAutonomousOutreachPreparationPilotPlanContext({
  leadId: LEAD,
  controlState: "active",
  runs: [],
  snapshot: readySnapshot,
  executionRuns: [executionCompleteRun],
  generatedAt: GENERATED_AT,
})
assert.equal(planContext.outreachAgentOwner, "outreach_agent")
assert.equal(planContext.outreachReadiness, "ready")
console.log("  ✓ Mission planning outreach context")

const settings = buildDefaultGrowthAutonomySettings(ORG)
settings.masterMode = "assisted"
settings.capabilityToggles.email_execution = true
const allowedPolicy = buildGrowthAiOsAutonomyPolicyReadModel({
  organizationId: ORG,
  generatedAt: GENERATED_AT,
  settings: {
    ...settings,
    killSwitches: {
      autonomyEnabled: true,
      autonomyOutboundEnabled: false,
      autonomyGenerationEnabled: true,
      autonomyObjectiveModeEnabled: false,
    },
  },
  runtimeEnabled: true,
  runtimePilotEnabled: true,
})
assert.equal(
  evaluateOutreachPreparationPilotAutonomyPolicyGate({ policy: allowedPolicy, settings }).allowed,
  true,
)
assert.equal(allowedPolicy.outreachAutonomyEnabled, true)
assert.ok(allowedPolicy.activeAutonomousAgents.includes("outreach_agent"))

settings.capabilityToggles.email_execution = false
const blockedPolicy = buildGrowthAiOsAutonomyPolicyReadModel({
  organizationId: ORG,
  generatedAt: GENERATED_AT,
  settings: {
    ...settings,
    killSwitches: {
      autonomyEnabled: true,
      autonomyOutboundEnabled: false,
      autonomyGenerationEnabled: true,
      autonomyObjectiveModeEnabled: false,
    },
  },
  runtimeEnabled: true,
  runtimePilotEnabled: true,
})
assert.equal(
  evaluateOutreachPreparationPilotAutonomyPolicyGate({ policy: blockedPolicy, settings }).allowed,
  false,
)
console.log("  ✓ Policy engine gate blocks disabled email_execution capability")

console.log("[GE-AIOS-GROWTH-5F] Running 5E regression…")
const regression5e = spawnSync("pnpm", ["test:ge-aios-growth-5e-internal-execution-agent"], {
  stdio: "inherit",
  shell: true,
})
assert.equal(regression5e.status, 0, "5E regression failed")

console.log("[GE-AIOS-GROWTH-5F] Autonomous Outreach Preparation Agent certification PASSED")
