/**
 * GE-AI-2F — Meta-Recommender foundation certification.
 * Run: pnpm test:ge-ai-2f-meta-recommender
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_AI_OS_COMMAND_CENTER_QA_MARKER } from "../lib/growth/aios/ai-os-command-center-types"
import { buildDefaultGrowthAutonomySettings } from "../lib/growth/autonomy/growth-autonomy-config"
import { buildGrowthAiOsAutonomyPolicyReadModel } from "../lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"
import {
  computeGrowthMetaRecommendationScore,
  synthesizeGrowthMetaRecommenderReadModel,
} from "../lib/growth/aios/recommendations/growth-meta-recommender-engine"
import {
  GROWTH_AIOS_GE_AI_2F_PHASE,
  GROWTH_META_RECOMMENDER_QA_MARKER,
  GROWTH_META_RECOMMENDER_RANKING_FORMULA,
  GROWTH_META_RECOMMENDER_RUNTIME_RULE,
} from "../lib/growth/aios/recommendations/growth-meta-recommender-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string, forbidden: string[]): void {
  const source = readSource(relativePath)
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

console.log(`[${GROWTH_AIOS_GE_AI_2F_PHASE}] Meta-Recommender foundation certification`)

assert.equal(GROWTH_META_RECOMMENDER_QA_MARKER, "growth-ge-ai-2f-meta-recommender-v1")
assert.ok(GROWTH_META_RECOMMENDER_RUNTIME_RULE.includes("read-only"))
assert.ok(GROWTH_META_RECOMMENDER_RANKING_FORMULA.includes("0.35"))

const requiredFiles = [
  "lib/growth/aios/recommendations/growth-meta-recommender-types.ts",
  "lib/growth/aios/recommendations/growth-meta-recommender-engine.ts",
  "lib/growth/aios/recommendations/growth-meta-recommender-service.ts",
  "app/api/platform/growth/ai-os/recommendations/route.ts",
  "components/growth/ai-os/command-center/growth-ai-os-meta-recommender-section.tsx",
  "docs/GE-AI-2F_META_RECOMMENDER_FOUNDATION.md",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
}

const service = readSource("lib/growth/aios/recommendations/growth-meta-recommender-service.ts")
assert.ok(service.includes('import "server-only"'))
assert.ok(service.includes("buildGrowthMetaRecommenderReadModel"))
assert.equal(service.includes("transitionAiWorkOrder"), false)
assert.equal(service.includes("send-sms"), false)

const engine = readSource("lib/growth/aios/recommendations/growth-meta-recommender-engine.ts")
assert.equal(engine.includes('import "server-only"'), false)
assert.ok(engine.includes("synthesizeGrowthMetaRecommenderReadModel"))
assert.ok(engine.includes("GROWTH_META_RECOMMENDER_SOURCE_COLLECTORS"))

const commandCenterService = readSource("lib/growth/aios/ai-os-command-center-service.ts")
assert.ok(commandCenterService.includes("buildGrowthMetaRecommenderReadModel"))
assert.ok(commandCenterService.includes("metaRecommender"))

const commandCenterTypes = readSource("lib/growth/aios/ai-os-command-center-types.ts")
assert.ok(commandCenterTypes.includes("metaRecommender: GrowthMetaRecommenderReadModel"))

const recommendationsRoute = readSource("app/api/platform/growth/ai-os/recommendations/route.ts")
assert.ok(recommendationsRoute.includes("requireGrowthEnginePlatformAccess(request)"))
assert.equal(recommendationsRoute.includes("POST"), false)
assert.equal(recommendationsRoute.includes("PUT"), false)

const panel = readSource("components/growth/ai-os/command-center/growth-ai-os-command-center-panel.tsx")
assert.ok(panel.includes("metaRecommender={model.metaRecommender}"))

const operationsUi = readSource("components/growth/ai-os/operations/growth-ai-os-operations-dashboard.tsx")
assert.ok(operationsUi.includes("GrowthAiOsMetaRecommenderSection"))

const metaUi = readSource("components/growth/ai-os/command-center/growth-ai-os-meta-recommender-section.tsx")
assert.equal(metaUi.includes('method: "POST"'), false)
assert.equal(metaUi.includes("Approve"), false)
assert.ok(metaUi.includes("Approval required"))

const generatedAt = "2026-06-25T12:00:00.000Z"
const policy = buildGrowthAiOsAutonomyPolicyReadModel({
  organizationId: "org-2f-cert",
  generatedAt,
  settings: {
    ...buildDefaultGrowthAutonomySettings(),
    killSwitches: {
      autonomyEnabled: true,
      autonomyOutboundEnabled: false,
      autonomyGenerationEnabled: false,
      autonomyObjectiveModeEnabled: false,
    },
  },
  runtimeEnabled: false,
  runtimePilotEnabled: false,
})

const fixtureCommandCenter = {
  readOnly: true as const,
  qaMarker: GROWTH_AI_OS_COMMAND_CENTER_QA_MARKER,
  generatedAt,
  executiveSummary: {
    headline: "Cert",
    activeMissionCount: 1,
    pendingWorkOrderCount: 0,
    approvalRequiredCount: 1,
    blockedWorkOrderCount: 0,
    recentEventCount: 0,
    primaryFocus: "Approve plan",
  },
  activeMissions: [],
  needsAttention: [
    {
      id: "approval:wo-1",
      kind: "approval_required" as const,
      title: "Approve generate_email Work Order",
      summary: "Awaiting operator approval.",
      severity: "high" as const,
      missionId: "mission-1",
      workOrderId: "wo-1",
      leadId: null,
      href: "/growth/os/missions/mission-1/planning",
    },
  ],
  recentActivity: [],
  executiveBrainActivity: [],
  pendingWorkOrders: [],
  approvalWorkOrders: [
    {
      workOrderId: "wo-1",
      missionId: "mission-1",
      workOrderType: "generate_email" as const,
      status: "awaiting_approval" as const,
      assignedAgent: "outreach" as const,
      priority: 90,
      updatedAt: generatedAt,
      planningReviewHref: "/growth/os/missions/mission-1/planning",
    },
  ],
  blockedWorkOrders: [],
  recentDecisionRecords: [],
  agentHealth: {
    organizationId: "org-2f-cert",
    evaluatedAt: generatedAt,
    staleThresholdMs: 60_000,
    agents: [],
    expiredLeases: 0,
  },
  providerHealth: {
    organizationId: "org-2f-cert",
    evaluatedAt: generatedAt,
    schemaReady: true,
    runtimeDegraded: false,
    degradedReason: null,
    activeProvider: "openai",
    providers: [],
    ready: true,
  },
  pilotStatus: {
    featureEnabled: false,
    enableAiEvidence: false,
    activePilotMissions: 0,
    recentLeadIds: [],
    observationHrefTemplate: "/growth/os/pilot/lead-research/{leadId}",
  },
  growthLeadResearchWorkflow: {
    workflowKey: "growth_lead_research",
    featureEnabled: true,
    statusCounts: {},
    activeLeads: [],
    assessedLeads: [],
    qualifiedLeads: [],
    blockedLeads: [],
    recommendedNextActions: [
      {
        leadId: "lead-1",
        companyName: "Cert Co",
        action: "Review outreach draft",
        workOrderType: null,
        reason: "Draft prepared",
        priority: "high",
        observationHref: "/growth/os/pilot/lead-research/lead-1",
      },
    ],
  },
  executionPlanReviewQueue: [],
  approvedPlanReadinessQueue: [],
  futureExecutionHandoffContracts: [],
  executionBoundaryAudit: {
    qaMarker: "x",
    generatedAt,
    rule: "rule",
    readOnly: true as const,
    items: [],
    summary: { total: 0, blocked: 0, allowed: 0 },
  },
  executionPreflightChecklist: {
    qaMarker: "x",
    generatedAt,
    rule: "rule",
    readOnly: true as const,
    items: [],
    summary: { total: 0, passed: 0, blocked: 0 },
  },
  executionSimulation: {
    qaMarker: "x",
    generatedAt,
    rule: "rule",
    readOnly: true as const,
    items: [],
    summary: { total: 0, passed: 0, blocked: 0 },
  },
  executionRuntime: {
    qaMarker: "x",
    generatedAt,
    rule: "rule",
    readOnly: true as const,
    pilotEnabled: false,
    items: [],
    summary: { total: 0, active: 0, completed: 0, blocked: 0 },
  },
  agentFramework: {
    qaMarker: "x",
    generatedAt,
    rule: "rule",
    readOnly: true as const,
    summary: { totalAgents: 0, enabledAgents: 0, disabledAgents: 0 },
    agents: [],
  },
  revenueOperator: {
    qaMarker: "growth-aios-growth-4b-revenue-operator-orchestration-v1",
    generatedAt,
    rule: "rule",
    supervisorAgent: "revenue_operator_agent",
    schedulerActive: false,
    summary: { leadsEvaluated: 0, humanReviewRequired: 0, blocked: 0, executionReady: 0 },
    orchestrations: [],
  },
  agentEvents: {
    qaMarker: "x",
    generatedAt,
    rule: "rule",
    readOnly: true as const,
    summary: { totalEvents: 0, pending: 0, blocked: 0 },
    partitions: { pending: [], blocked: [], completed: [] },
  },
  agentMemory: {
    qaMarker: "x",
    generatedAt,
    rule: "rule",
    readOnly: true as const,
    summary: { leadsIndexed: 0, conflictsDetected: 0, completenessAverage: 0 },
    entries: [],
  },
  missionFramework: {
    qaMarker: "x",
    generatedAt,
    rule: "rule",
    readOnly: true as const,
    summary: { totalMissions: 0, activeMissions: 0, stalledMissions: 0 },
    missions: [],
  },
  missionPriority: {
    qaMarker: "growth-aios-growth-4f-mission-priority-v1",
    generatedAt,
    rule: "rule",
    schedulerActive: false,
    summary: {
      missionsRanked: 0,
      immediate: 0,
      today: 0,
      deferred: 0,
      blocked: 0,
      abandonRecommended: 0,
      starvationIssues: 0,
    },
    capacityPool: [],
    rankedMissions: [],
    queues: { immediate: [], today: [], this_week: [], backlog: [], archive_candidate: [] },
    starvationIssues: [],
    revenueOperatorGuidance: {
      highestValueWork: "",
      shouldHappenToday: "",
      canSafelyWait: "",
      shouldAbandon: "",
      capacitySpend: "",
    },
  },
  schedulerReadiness: {
    qaMarker: "x",
    generatedAt,
    rule: "rule",
    readOnly: true as const,
    summary: {
      activationStatus: "inactive",
      blockedReasonCount: 0,
      wakeRulesDefined: 0,
    },
    wakeRules: [],
    blockers: [],
  },
  autonomousResearchPilot: {
    qaMarker: "x",
    generatedAt,
    rule: "rule",
    agentKind: "research_agent",
    schedulerMode: "controlled_agent_wake",
    controlState: "disabled",
    enabled: false,
    budgetLimits: { maxRunsPerHour: 0, maxRunsPerDay: 0, maxRetriesPerLeadPerDay: 0 },
    telemetry: {
      successfulRuns: 0,
      failedRuns: 0,
      skippedRuns: 0,
      eligibleLeads: 0,
      staleResearchResolved: 0,
      budgetConsumptionHour: 0,
      budgetConsumptionDay: 0,
      activeRuns: 0,
    },
    recentRuns: [],
    revenueOperatorSupervision: {
      approveWakeRecommendation: "",
      budgetMonitorSummary: "",
      failureMonitorSummary: "",
      pauseRecommendation: null,
      escalationRecommendation: null,
      latestOutcomeRecommendation: null,
    },
    wakeConditionsSupported: [],
  },
  autonomousQualificationPilot: {
    qaMarker: "x",
    generatedAt,
    rule: "rule",
    agentKind: "qualification_agent",
    schedulerMode: "controlled_agent_wake",
    controlState: "disabled",
    enabled: false,
    budgetLimits: { maxRunsPerHour: 0, maxRunsPerDay: 0, maxRetriesPerLeadPerDay: 0 },
    telemetry: {
      successfulRuns: 0,
      failedRuns: 0,
      skippedRuns: 0,
      eligibleLeads: 0,
      qualificationsCompleted: 0,
      budgetConsumptionHour: 0,
      budgetConsumptionDay: 0,
      activeRuns: 0,
    },
    recentRuns: [],
    revenueOperatorSupervision: {
      approveWakeRecommendation: "",
      budgetMonitorSummary: "",
      failureMonitorSummary: "",
      pauseRecommendation: null,
      escalationRecommendation: null,
      latestOutcomeRecommendation: null,
    },
    wakeConditionsSupported: [],
  },
  autonomousPlanningPilot: {
    qaMarker: "x",
    generatedAt,
    rule: "rule",
    agentKind: "planning_agent",
    schedulerMode: "controlled_agent_wake",
    controlState: "disabled",
    enabled: false,
    budgetLimits: { maxRunsPerHour: 0, maxRunsPerDay: 0, maxRetriesPerLeadPerDay: 0 },
    telemetry: {
      successfulRuns: 0,
      failedRuns: 0,
      skippedRuns: 0,
      eligibleLeads: 0,
      plansGenerated: 0,
      budgetConsumptionHour: 0,
      budgetConsumptionDay: 0,
      activeRuns: 0,
    },
    recentRuns: [],
    revenueOperatorSupervision: {
      approveWakeRecommendation: "",
      budgetMonitorSummary: "",
      failureMonitorSummary: "",
      pauseRecommendation: null,
      escalationRecommendation: null,
      latestOutcomeRecommendation: null,
    },
    wakeConditionsSupported: [],
  },
  autonomousExecutionPilot: {
    qaMarker: "x",
    generatedAt,
    rule: "rule",
    agentKind: "execution_agent",
    schedulerMode: "controlled_agent_wake",
    controlState: "disabled",
    enabled: false,
    budgetLimits: { maxRunsPerHour: 0, maxRunsPerDay: 0, maxRetriesPerPlanPerDay: 0 },
    telemetry: {
      successfulRuns: 0,
      failedRuns: 0,
      skippedRuns: 0,
      eligibleLeads: 0,
      executionsEnqueued: 0,
      budgetConsumptionHour: 0,
      budgetConsumptionDay: 0,
      activeRuns: 0,
    },
    recentRuns: [],
    revenueOperatorSupervision: {
      approveWakeRecommendation: "",
      budgetMonitorSummary: "",
      failureMonitorSummary: "",
      pauseRecommendation: null,
      escalationRecommendation: null,
      latestOutcomeRecommendation: null,
    },
    wakeConditionsSupported: [],
  },
  autonomousOutreachPreparationPilot: {
    qaMarker: "x",
    generatedAt,
    rule: "rule",
    agentKind: "outreach_agent",
    schedulerMode: "controlled_agent_wake",
    controlState: "disabled",
    enabled: false,
    preparationModeOnly: true,
    allowedWorkflow: "growth_lead_research",
    disabledAgentKinds: [],
    budgetLimits: { maxRunsPerHour: 0, maxRunsPerDay: 0, maxRetriesPerLeadPerDay: 0 },
    telemetry: {
      successfulRuns: 0,
      failedRuns: 0,
      skippedRuns: 0,
      eligibleLeads: 0,
      draftsPrepared: 0,
      approvalPackagesWaiting: 0,
      blockedPreparations: 0,
      budgetConsumptionHour: 0,
      budgetConsumptionDay: 0,
      activeRuns: 0,
    },
    latestPackages: [],
    recentRuns: [],
    revenueOperatorSupervision: {
      approveWakeRecommendation: "",
      budgetMonitorSummary: "",
      failureMonitorSummary: "",
      pauseRecommendation: null,
      escalationRecommendation: null,
      latestOutcomeRecommendation: null,
    },
    wakeConditionsSupported: [],
  },
  autonomousMeetingPilot: {
    qaMarker: "x",
    generatedAt,
    rule: "rule",
    agentKind: "meeting_agent",
    schedulerMode: "controlled_agent_wake",
    controlState: "disabled",
    enabled: false,
    preparationModeOnly: true,
    allowedWorkflow: "growth_lead_research",
    disabledAgentKinds: [],
    budgetLimits: { maxRunsPerHour: 0, maxRunsPerDay: 0, maxRetriesPerLeadPerDay: 0 },
    telemetry: {
      successfulRuns: 0,
      failedRuns: 0,
      skippedRuns: 0,
      eligibleLeads: 0,
      briefsPrepared: 0,
      preparationPackagesWaiting: 0,
      blockedPreparations: 0,
      budgetConsumptionHour: 0,
      budgetConsumptionDay: 0,
      activeRuns: 0,
    },
    latestPackages: [],
    recentRuns: [],
    revenueOperatorSupervision: {
      approveWakeRecommendation: "",
      budgetMonitorSummary: "",
      failureMonitorSummary: "",
      pauseRecommendation: null,
      escalationRecommendation: null,
      latestOutcomeRecommendation: null,
    },
    wakeConditionsSupported: [],
  },
  safeMode: {
    emergencyStopActive: false,
    objectiveModeEnabled: false,
    autonomyEnabled: true,
    killSwitches: {},
  },
}

const readModelA = synthesizeGrowthMetaRecommenderReadModel({
  organizationId: "org-2f-cert",
  generatedAt,
  commandCenter: fixtureCommandCenter,
  policyContext: {
    emergencyStopActive: policy.emergencyStopActive,
    autonomyEnabled: policy.autonomyEnabled,
    controlPlaneHref: policy.controlPlaneHref,
  },
})

const readModelB = synthesizeGrowthMetaRecommenderReadModel({
  organizationId: "org-2f-cert",
  generatedAt,
  commandCenter: fixtureCommandCenter,
  policyContext: {
    emergencyStopActive: policy.emergencyStopActive,
    autonomyEnabled: policy.autonomyEnabled,
    controlPlaneHref: policy.controlPlaneHref,
  },
})

assert.equal(readModelA.qaMarker, GROWTH_META_RECOMMENDER_QA_MARKER)
assert.ok(readModelA.topRecommendations.length > 0)
assert.ok(readModelA.topRecommendations.length <= 5)
assert.ok(readModelA.recommendations.every((rec) => rec.evidence.length > 0))
assert.deepEqual(
  readModelA.topRecommendations.map((rec) => rec.id),
  readModelB.topRecommendations.map((rec) => rec.id),
)
assert.ok(readModelA.recommendations.some((rec) => rec.policy.requiresHumanApproval))

const externalRec = readModelA.recommendations.find((rec) => rec.recommendationType === "prepare_outreach")
if (externalRec) {
  assert.equal(externalRec.policy.requiresHumanApproval, true)
}

assert.equal(computeGrowthMetaRecommendationScore({ impact: 100, urgency: 100, confidence: 100, effort: 0 }), 85)
assert.equal(computeGrowthMetaRecommendationScore({ impact: 0, urgency: 0, confidence: 0, effort: 100 }), 0)

const brokenInput = {
  ...fixtureCommandCenter,
  missionPriority: {
    ...fixtureCommandCenter.missionPriority,
    get rankedMissions() {
      throw new Error("simulated mission priority failure")
    },
  },
}

const resilient = synthesizeGrowthMetaRecommenderReadModel({
  organizationId: "org-2f-cert",
  generatedAt,
  commandCenter: brokenInput as typeof fixtureCommandCenter,
})
assert.ok(resilient.sourcesFailed.some((row) => row.source === "mission_priority.ranked_missions"))
assert.ok(resilient.topRecommendations.length > 0)

for (const file of [
  "lib/growth/aios/recommendations/growth-meta-recommender-engine.ts",
  "lib/growth/aios/recommendations/growth-meta-recommender-service.ts",
  "lib/growth/aios/ai-os-command-center-service.ts",
]) {
  assertNoCoreTouch(file, ["public.invoices", "public.quotes", "send-sms", "transitionAiWorkOrder"])
}

const regressionScripts = [
  "test:prod-regression-6-command-center-import-stability",
  "test:ge-aios-5c-command-center-read-model-foundation",
  "test:ge-aios-growth-4b-revenue-operator",
  "test:ge-aios-growth-4f-priority-engine",
]
for (const script of regressionScripts) {
  execSync(`pnpm ${script}`, { stdio: "inherit", cwd: process.cwd() })
}

console.log(`[${GROWTH_AIOS_GE_AI_2F_PHASE}] PASS — Meta-Recommender foundation certified (local)`)

