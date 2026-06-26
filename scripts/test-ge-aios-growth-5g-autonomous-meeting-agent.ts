/**
 * GE-AIOS-GROWTH-5G — Autonomous Meeting Agent certification.
 * Run: pnpm test:ge-aios-growth-5g-autonomous-meeting-agent
 */
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_AGENT_KINDS } from "../lib/growth/aios/growth/growth-agent-framework-types"
import type { GrowthAutonomousExecutionRunRecord } from "../lib/growth/aios/growth/growth-autonomous-execution-pilot-types"
import type { GrowthAutonomousOutreachPreparationRunRecord } from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import {
  applyMeetingPilotControlTransition,
  buildAutonomousMeetingPilotPlanContext,
  buildAutonomousMeetingPilotReadModel,
  buildAutonomousMeetingRunRecord,
  buildOperationsMeetingAgentStatus,
  enforceMeetingAgentBudget,
  evaluateMeetingMemoryReadiness,
  evaluateMeetingPreparationGateReadiness,
  evaluateMeetingPreparationWakeCondition,
  hasCompletedOutreachPreparationWithApproval,
  hasRequiredContactData,
  isMeetingAgentSchedulerActive,
  summarizePreparedMeetingAssetsForPackage,
} from "../lib/growth/aios/growth/growth-autonomous-meeting-pilot-engine"
import {
  resetAutonomousMeetingPilotOrgState,
  setAutonomousMeetingPilotControlState,
} from "../lib/growth/aios/growth/growth-autonomous-meeting-pilot-store"
import {
  GROWTH_AUTONOMOUS_MEETING_PREPARED_EVENT,
  GROWTH_AUTONOMOUS_MEETING_PILOT_AGENT,
  GROWTH_AUTONOMOUS_MEETING_PILOT_BUDGET,
  GROWTH_AUTONOMOUS_MEETING_PILOT_MIN_CONFIDENCE,
  GROWTH_AUTONOMOUS_MEETING_PILOT_QA_MARKER,
  GROWTH_AUTONOMOUS_MEETING_PILOT_RULE,
  GROWTH_AUTONOMOUS_MEETING_PILOT_SCHEDULER_MODE,
  GROWTH_AUTONOMOUS_MEETING_PILOT_WAKE_CONDITIONS,
} from "../lib/growth/aios/growth/growth-autonomous-meeting-pilot-types"
import {
  buildGrowthAiOsAutonomyPolicyReadModel,
  evaluateMeetingPilotAutonomyPolicyGate,
} from "../lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"
import { buildDefaultGrowthAutonomySettings } from "../lib/growth/autonomy/growth-autonomy-config"
import { buildAgentWakeRules as buildSchedulerWakeRules } from "../lib/growth/aios/growth/growth-scheduler-readiness-engine"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoForbiddenPaths(relativePath: string): void {
  const source = readSource(relativePath)
  for (const token of [
    "createGrowthMeeting",
    "syncGrowthMeetingToGoogleCalendar",
    "submitPublicBooking",
    "createOpportunityFromApprovedDraft",
    "createAiWorkOrder",
    "executeTransportSend",
    "sendEmail",
    "sendSms",
    "execute-outreach",
    "cron.schedule",
    "setInterval",
    "startWorkflow",
  ]) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

const ORG = "org-cert-5g"
const GENERATED_AT = "2026-06-25T18:00:00.000Z"
const LEAD = "lead-cert-5g"

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

const outreachCompleteRun: GrowthAutonomousOutreachPreparationRunRecord = {
  runId: "outreach-run-1",
  leadId: LEAD,
  companyName: "Cert Co",
  wakeCondition: "execution_completed",
  outcome: "completed",
  startedAt: GENERATED_AT,
  completedAt: GENERATED_AT,
  durationMs: 1000,
  packageId: "outreach-pkg-1",
  workflowType: "outreach_generation",
  confidence: 0.7,
  skipReason: null,
  blockReason: null,
  revenueOperatorHandoff: "human_review_required",
  approvalPackage: {
    packageId: "outreach-pkg-1",
    leadId: LEAD,
    companyName: "Cert Co",
    preparedAt: GENERATED_AT,
    generatedAssets: [],
    personalizationEvidence: [],
    supportingResearch: [],
    confidence: 0.7,
    approvalRequirements: ["operator_outbound_approval"],
    complianceNotes: [],
    recommendedChannel: "email",
    recommendedSequence: "email_first",
    expectedOutcome: "Human-approved outreach",
    pendingHumanApproval: true,
    transportBlocked: true,
  },
}

const readySnapshot = {
  workflowKey: "growth_lead_research" as const,
  workflowStatus: "assessed" as const,
  leadId: LEAD,
  researchRunId: "research-1",
  missionId: "mission-1",
  companyName: "Cert Co",
  qualification: { fitScore: 72, confidence: 0.7, recommendedNextAction: "Prepare meeting", reason: "Qualified" },
  executionPlan: {
    workflowType: "research_company" as const,
    nextBestAction: "Prepare meeting brief",
    estimatedDuration: "1d",
    estimatedCost: "low",
    expectedOutcome: "Human-conducted meeting",
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

console.log("[GE-AIOS-GROWTH-5G] Autonomous Meeting Agent certification")

assert.equal(GROWTH_AUTONOMOUS_MEETING_PILOT_QA_MARKER, "growth-aios-growth-5g-autonomous-meeting-pilot-v1")
assert.match(GROWTH_AUTONOMOUS_MEETING_PILOT_RULE, /Meeting Agent|preparation|No calendar writes/i)
assert.equal(GROWTH_AUTONOMOUS_MEETING_PILOT_AGENT, "meeting_agent")
assert.equal(GROWTH_AUTONOMOUS_MEETING_PILOT_SCHEDULER_MODE, "controlled_agent_wake")
assert.equal(GROWTH_AUTONOMOUS_MEETING_PILOT_WAKE_CONDITIONS.length, 3)
assert.equal(GROWTH_AUTONOMOUS_MEETING_PILOT_BUDGET.maxRunsPerHour, 20)
assert.equal(GROWTH_AUTONOMOUS_MEETING_PILOT_BUDGET.maxRunsPerDay, 200)
assert.equal(GROWTH_AUTONOMOUS_MEETING_PILOT_BUDGET.maxRetriesPerLeadPerDay, 3)
assert.equal(GROWTH_AUTONOMOUS_MEETING_PREPARED_EVENT, "growth.meeting.prepared")
console.log("  ✓ QA marker and pilot constants")

assertNoForbiddenPaths("lib/growth/aios/growth/growth-autonomous-meeting-pilot-types.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-autonomous-meeting-pilot-engine.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-autonomous-meeting-pilot-store.ts")
console.log("  ✓ No forbidden side-effect tokens in engine/types/store")

const serviceSource = readSource("lib/growth/aios/growth/growth-autonomous-meeting-pilot-service.ts")
const draftSource = readSource("lib/growth/aios/growth/growth-autonomous-meeting-pilot-draft-service.ts")
assert.match(serviceSource, /fetchGrowthAiOsAutonomyPolicyEvaluationContext/)
assert.match(serviceSource, /evaluateMeetingPilotAutonomyPolicyGate/)
assert.match(serviceSource, /GROWTH_AUTONOMOUS_MEETING_PREPARED_EVENT/)
assert.match(draftSource, /gatherMeetingPrepBundleForMeeting/)
assert.match(draftSource, /generateAiMeetingPrep/)
assert.match(draftSource, /generateAndPersistAiMeetingPrep/)
assert.equal(draftSource.includes("createGrowthMeeting"), false)
assert.equal(draftSource.includes("syncGrowthMeetingToGoogleCalendar"), false)
console.log("  ✓ Reuses existing meeting intelligence without booking/calendar writes")

const actionRoute = readSource("app/api/platform/growth/ai-os/autonomous-meeting-pilot/action/route.ts")
assert.match(actionRoute, /403/)
console.log("  ✓ Legacy action API policy-gated")

const operationsUi = readSource("components/growth/ai-os/operations/growth-ai-os-operations-dashboard.tsx")
assert.match(operationsUi, /Meeting Agent/)
assert.match(operationsUi, /meetingAgentStatus/)
console.log("  ✓ AI Operations compact Meeting Agent status")

const missionPlanning = readSource("lib/growth/aios/ai-executive-mission-planning-review-service.ts")
assert.match(missionPlanning, /buildGrowthAutonomousMeetingPilotPlanContext/)
assert.match(missionPlanning, /autonomousMeetingPilotContext/)
console.log("  ✓ Mission Planning Review meeting context")

assert.equal(hasRequiredContactData({ contactName: "Alex", email: null, phone: null, decisionMakerCount: 0 }), true)
assert.equal(hasRequiredContactData({ contactName: null, email: null, phone: null, decisionMakerCount: 0 }), false)
assert.equal(
  hasCompletedOutreachPreparationWithApproval({ outreachRuns: [outreachCompleteRun], leadId: LEAD }),
  true,
)
assert.equal(evaluateMeetingMemoryReadiness({ snapshot: readySnapshot, hasContactData: true }).sufficient, true)
assert.equal(evaluateMeetingMemoryReadiness({ snapshot: null, hasContactData: true }).sufficient, false)

const gateReady = evaluateMeetingPreparationGateReadiness({
  snapshot: readySnapshot,
  executionRuns: [executionCompleteRun],
  outreachRuns: [outreachCompleteRun],
  leadId: LEAD,
  confidence: 0.7,
  hasContactData: true,
})
assert.equal(gateReady.eligible, true)

const gateNoOutreach = evaluateMeetingPreparationGateReadiness({
  snapshot: readySnapshot,
  executionRuns: [executionCompleteRun],
  outreachRuns: [],
  leadId: LEAD,
  confidence: 0.7,
  hasContactData: true,
})
assert.equal(gateNoOutreach.eligible, false)
assert.match(gateNoOutreach.blockReason ?? "", /outreach approval package/i)

const gateLowConfidence = evaluateMeetingPreparationGateReadiness({
  snapshot: readySnapshot,
  executionRuns: [executionCompleteRun],
  outreachRuns: [outreachCompleteRun],
  leadId: LEAD,
  confidence: 0.2,
  hasContactData: true,
})
assert.equal(gateLowConfidence.eligible, false)
assert.match(gateLowConfidence.blockReason ?? "", /confidence below threshold/i)
console.log("  ✓ Wake requires outreach approval package, contact data, and confidence threshold")

const schedulerWakeRules = buildSchedulerWakeRules()
const meetingWake = schedulerWakeRules.find((rule) => rule.agentKind === "meeting_agent")
const outreachWake = schedulerWakeRules.find((rule) => rule.agentKind === "outreach_agent")
assert.ok(meetingWake)
assert.ok(outreachWake)
assert.ok(meetingWake!.wakeAllowedInPhase)
assert.ok(outreachWake!.wakeAllowedInPhase)
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
console.log("  ✓ Meeting Agent may wake in controlled_agent_wake pilot phase")

resetAutonomousMeetingPilotOrgState(ORG)
assert.equal(isMeetingAgentSchedulerActive("disabled"), false)
assert.equal(isMeetingAgentSchedulerActive("active"), true)

const runs = Array.from({ length: 20 }, (_, index) =>
  buildAutonomousMeetingRunRecord({
    leadId: `lead-${index}`,
    companyName: "Cert Co",
    wakeCondition: "outreach_preparation_completed",
    generatedAt: new Date(Date.parse(GENERATED_AT) - index * 60_000).toISOString(),
    outcome: "completed",
    preparationPackage: {
      packageId: `pkg-${index}`,
      leadId: `lead-${index}`,
      meetingId: null,
      companyName: "Cert Co",
      preparedAt: GENERATED_AT,
      generatedAssets: summarizePreparedMeetingAssetsForPackage({
        artifacts: {
          executive_brief: "Executive brief for Cert Co",
          meeting_objective: "Validate fit",
          suggested_agenda: [{ segment: "Discovery", duration_minutes: 15, objective: "Map pain" }],
          stakeholder_analysis: [{ role_category: "Executive", contact_name: "Alex", title: "CEO", talking_points: ["ROI"], messaging_themes: [] }],
          likely_objections: [{ objection: "Budget", response_angle: "Anchor value", evidence: "Q4 planning" }],
          discovery_questions: ["What outcomes matter this quarter?"],
          competitive_risks: [],
          recommended_outcome: "Schedule follow-up",
          confidence_score: 0.7,
          reasoning: "Strong fit signals",
        },
        accountSummary: "Cert Co · SaaS",
        roiDiscussion: "Anchor ROI on operational efficiency",
        followUpRecommendations: "Send recap within 24 hours",
      }),
      supportingResearch: [],
      confidence: 0.7,
      readinessScore: 72,
      approvalRequirements: ["operator_meeting_review"],
      complianceNotes: ["Preparation-only"],
      recommendedAgenda: "Discovery (15m)",
      expectedOutcome: "Human-conducted meeting",
      pendingHumanApproval: true,
      calendarBlocked: true,
      bookingBlocked: true,
    },
  }),
)

const budgetBlocked = enforceMeetingAgentBudget({ runs, generatedAt: GENERATED_AT })
assert.equal(budgetBlocked.allowed, false)
console.log("  ✓ Hourly budget limits enforced (20/hr)")

const assets = summarizePreparedMeetingAssetsForPackage({
  artifacts: {
    executive_brief: "Brief",
    meeting_objective: "Objective",
    suggested_agenda: [{ segment: "Intro", duration_minutes: 5, objective: "Rapport" }],
    stakeholder_analysis: [],
    likely_objections: [],
    discovery_questions: ["Question 1"],
    competitive_risks: [],
    recommended_outcome: "Next step",
    confidence_score: 0.7,
    reasoning: "Reason",
  },
  accountSummary: "Account summary",
  roiDiscussion: "ROI angle",
  followUpRecommendations: "Follow up",
})
assert.equal(assets.length, 9)
assert.ok(assets.every((asset) => asset.preparationOnly))
console.log("  ✓ Preparation package asset summaries generated")

const readModel = buildAutonomousMeetingPilotReadModel({
  controlState: "active",
  runs,
  generatedAt: GENERATED_AT,
  eligibleLeads: 2,
})
assert.deepEqual(readModel.disabledAgentKinds, [])
assert.equal(readModel.preparationModeOnly, true)
const opsStatus = buildOperationsMeetingAgentStatus({
  pilot: readModel,
  configureHref: "/growth/settings/autonomy",
})
assert.ok(opsStatus.briefsPrepared >= 9)
console.log("  ✓ Deterministic read model and operations status")

const wakeCondition = evaluateMeetingPreparationWakeCondition({
  leadId: LEAD,
  runs: [],
  generatedAt: GENERATED_AT,
  gateReadiness: gateReady,
})
assert.equal(wakeCondition, "outreach_preparation_completed")

const planContext = buildAutonomousMeetingPilotPlanContext({
  leadId: LEAD,
  controlState: "active",
  runs: [],
  snapshot: readySnapshot,
  executionRuns: [executionCompleteRun],
  outreachRuns: [outreachCompleteRun],
  generatedAt: GENERATED_AT,
  hasContactData: true,
})
assert.equal(planContext.meetingAgentOwner, "meeting_agent")
assert.equal(planContext.meetingReadiness, "ready")
console.log("  ✓ Mission planning meeting context")

const settings = buildDefaultGrowthAutonomySettings(ORG)
settings.masterMode = "assisted"
settings.capabilityToggles.task_creation = true
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
assert.equal(evaluateMeetingPilotAutonomyPolicyGate({ policy: allowedPolicy, settings }).allowed, true)
assert.equal(allowedPolicy.meetingAutonomyEnabled, true)
assert.ok(allowedPolicy.activeAutonomousAgents.includes("meeting_agent"))

settings.capabilityToggles.task_creation = false
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
assert.equal(evaluateMeetingPilotAutonomyPolicyGate({ policy: blockedPolicy, settings }).allowed, false)
console.log("  ✓ Policy engine gate blocks disabled task_creation capability")

setAutonomousMeetingPilotControlState({ organizationId: ORG, controlState: "active", now: GENERATED_AT })

console.log("[GE-AIOS-GROWTH-5G] Running 5F regression…")
const regression5f = spawnSync("pnpm", ["test:ge-aios-growth-5f-autonomous-outreach-preparation"], {
  stdio: "inherit",
  shell: true,
})
assert.equal(regression5f.status, 0, "5F regression failed")

console.log("[GE-AIOS-GROWTH-5G] Autonomous Meeting Agent certification PASSED")
