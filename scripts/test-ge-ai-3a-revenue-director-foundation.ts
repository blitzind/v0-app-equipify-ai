/**
 * GE-AI-3A — Revenue Director foundation certification.
 * Run: pnpm test:ge-ai-3a-revenue-director-foundation
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_AI_OS_COMMAND_CENTER_QA_MARKER } from "../lib/growth/aios/ai-os-command-center-types"
import { GROWTH_AI_EVENT_BUS_QA_MARKER } from "../lib/growth/aios/event-bus/growth-ai-event-bus-types"
import {
  GROWTH_AI_EVENT_BUS_SUBSCRIBER_DEFINITIONS,
  growthAiEventBusSubscriberObservesEvent,
} from "../lib/growth/aios/event-bus/growth-ai-event-bus-engine"
import { GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER } from "../lib/growth/aios/approvals/growth-human-approval-center-types"
import { GROWTH_COMMUNICATION_ENGINE_QA_MARKER } from "../lib/growth/aios/communication/growth-communication-engine-types"
import { GROWTH_META_RECOMMENDER_QA_MARKER } from "../lib/growth/aios/recommendations/growth-meta-recommender-types"
import { GROWTH_PRIORITY_ENGINE_BINDING_QA_MARKER } from "../lib/growth/aios/priority/growth-priority-engine-binding-types"
import { GROWTH_MISSION_FRAMEWORK_QA_MARKER } from "../lib/growth/aios/growth/growth-mission-framework-types"
import { GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER } from "../lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import { GROWTH_REVENUE_OPERATOR_ORCHESTRATION_QA_MARKER } from "../lib/growth/aios/growth/growth-revenue-operator-orchestration-types"
import {
  extractGrowthRevenueDirectorSnapshot,
  synthesizeGrowthRevenueDirectorReadModel,
} from "../lib/growth/aios/revenue-director/growth-revenue-director-engine"
import {
  GROWTH_AIOS_GE_AI_3A_PHASE,
  GROWTH_REVENUE_DIRECTOR_EVENT_TYPES,
  GROWTH_REVENUE_DIRECTOR_QA_MARKER,
  GROWTH_REVENUE_DIRECTOR_RUNTIME_RULE,
  type GrowthRevenueDirectorCommandCenterSnapshot,
} from "../lib/growth/aios/revenue-director/growth-revenue-director-types"
import { isRegisteredAiEventType } from "../lib/growth/aios/ai-event-registry"
import { buildDefaultGrowthAutonomySettings } from "../lib/growth/autonomy/growth-autonomy-config"
import { buildGrowthAiOsAutonomyPolicyReadModel } from "../lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"
import { GROWTH_AI_OS_OPERATIONS_DASHBOARD_QA_MARKER } from "../lib/growth/aios/ai-os-operations-dashboard-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string, forbidden: string[]): void {
  const source = readSource(relativePath)
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

function assertNoDirectSubsystemReads(relativePath: string): void {
  const source = readSource(relativePath)
  const forbiddenImports = [
    "fetchBoundedAutonomousOutboundReadModel",
    "buildGrowthMetaRecommenderReadModel",
    "buildGrowthCommunicationEngineReadModel",
    "fetchGrowthHumanApprovalCenterReadModel",
    "buildGrowthPriorityEngineBindingReadModel",
    "buildRevenueOperatorReadModel",
    "listGrowthObjectives",
    "runSequenceExecutionJob",
    "send-sms",
  ]
  for (const token of forbiddenImports) {
    assert.equal(source.includes(token), false, `${relativePath} must not read ${token} directly`)
  }
}

console.log(`[${GROWTH_AIOS_GE_AI_3A_PHASE}] Revenue Director foundation certification`)

assert.equal(GROWTH_REVENUE_DIRECTOR_QA_MARKER, "growth-ge-ai-3a-revenue-director-v1")
assert.ok(GROWTH_REVENUE_DIRECTOR_RUNTIME_RULE.includes("read-only"))
assert.equal(isRegisteredAiEventType(GROWTH_REVENUE_DIRECTOR_EVENT_TYPES.snapshotGenerated), true)

const requiredFiles = [
  "lib/growth/aios/revenue-director/growth-revenue-director-types.ts",
  "lib/growth/aios/revenue-director/growth-revenue-director-engine.ts",
  "lib/growth/aios/revenue-director/growth-revenue-director-service.ts",
  "app/api/platform/growth/ai-os/revenue-director/route.ts",
  "components/growth/ai-os/command-center/growth-ai-os-revenue-director-section.tsx",
  "docs/GE-AI-3A_REVENUE_DIRECTOR_FOUNDATION.md",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
}

const service = readSource("lib/growth/aios/revenue-director/growth-revenue-director-service.ts")
assert.ok(service.includes('import "server-only"'))
assert.ok(service.includes("buildGrowthRevenueDirectorReadModel"))
assert.ok(service.includes("extractGrowthRevenueDirectorSnapshot"))
assertNoDirectSubsystemReads("lib/growth/aios/revenue-director/growth-revenue-director-service.ts")

const engine = readSource("lib/growth/aios/revenue-director/growth-revenue-director-engine.ts")
assert.equal(engine.includes('import "server-only"'), false)
assert.ok(engine.includes("GrowthRevenueDirectorCommandCenterSnapshot"))
assert.ok(engine.includes("synthesizeGrowthRevenueDirectorReadModel"))
assertNoDirectSubsystemReads("lib/growth/aios/revenue-director/growth-revenue-director-engine.ts")

const commandCenterService = readSource("lib/growth/aios/ai-os-command-center-service.ts")
assert.ok(commandCenterService.includes("buildGrowthRevenueDirectorReadModel"))
assert.ok(commandCenterService.includes("revenueDirector"))

const route = readSource("app/api/platform/growth/ai-os/revenue-director/route.ts")
assert.ok(route.includes("requireGrowthEnginePlatformAccess(request)"))
assert.equal(route.includes("POST"), false)

const ui = readSource("components/growth/ai-os/command-center/growth-ai-os-revenue-director-section.tsx")
assert.equal(ui.includes("Approve"), false)
assert.equal(ui.includes("Send"), false)
assert.ok(ui.includes("Advisory"))

assert.ok(
  GROWTH_AI_EVENT_BUS_SUBSCRIBER_DEFINITIONS.some(
    (row) => row.subscriberId === "revenue_director_observer",
  ),
)
assert.ok(
  growthAiEventBusSubscriberObservesEvent("revenue_director_observer", {
    id: "evt-1",
    organizationId: "org-1",
    category: "executive",
    eventType: "growth.revenue_director.snapshot_generated",
    producer: "test",
    source: "test",
    payload: {},
    metadata: {},
    occurredAt: "2026-06-25T12:00:00.000Z",
    createdAt: "2026-06-25T12:00:00.000Z",
    eventVersion: 1,
    schemaVersion: "1.0",
    correlationId: null,
    agentOwner: null,
  }),
)

const generatedAt = "2026-06-25T12:00:00.000Z"
const settingsWithKillSwitches = {
  ...buildDefaultGrowthAutonomySettings("org-3a-cert"),
  killSwitches: {
    autonomyEnabled: true,
    autonomyOutboundEnabled: true,
    autonomyGenerationEnabled: false,
    autonomyObjectiveModeEnabled: false,
  },
}
const autonomyPolicy = buildGrowthAiOsAutonomyPolicyReadModel({
  organizationId: "org-3a-cert",
  generatedAt,
  settings: settingsWithKillSwitches,
  runtimeEnabled: false,
  runtimePilotEnabled: false,
})

const emptySnapshot: GrowthRevenueDirectorCommandCenterSnapshot = {
  generatedAt,
  executiveSummary: {
    headline: "Cert headline",
    activeMissionCount: 1,
    pendingWorkOrderCount: 0,
    approvalRequiredCount: 2,
    blockedWorkOrderCount: 0,
    recentEventCount: 0,
    primaryFocus: "Review approvals",
  },
  activeMissions: [],
  needsAttention: [
    {
      id: "att-1",
      kind: "approval_required",
      title: "Approve outreach",
      summary: "Needs operator",
      severity: "high",
      missionId: "m-1",
      workOrderId: "wo-1",
      leadId: "lead-1",
      href: "/growth/os/approvals",
    },
  ],
  agentHealth: {
    organizationId: "org-3a-cert",
    evaluatedAt: generatedAt,
    staleThresholdMs: 60_000,
    agents: [],
    expiredLeases: 0,
  },
  missionFramework: {
    qaMarker: GROWTH_MISSION_FRAMEWORK_QA_MARKER,
    generatedAt,
    rule: "read-only",
    schedulerActive: false,
    summary: { totalMissions: 1, active: 1, blocked: 0, completed: 0, stalled: 1, waitingForHuman: 0 },
    planner: { activeMissions: [], completedMissions: [], stalledMissions: [], recommendedNewMissions: [], recommendedRetiringMissions: [] },
    missions: [],
  },
  missionPriority: {
    qaMarker: "growth-aios-growth-4f-mission-priority-v1",
    generatedAt,
    rule: "read-only",
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
      shouldDefer: "",
      shouldAbandon: "",
      capacitySpend: "",
    },
  },
  revenueOperator: {
    qaMarker: GROWTH_REVENUE_OPERATOR_ORCHESTRATION_QA_MARKER,
    generatedAt,
    rule: "read-only",
    supervisorAgent: "revenue_operator_agent",
    schedulerActive: false,
    summary: { leadsEvaluated: 1, humanReviewRequired: 1, blocked: 1, executionReady: 0 },
    orchestrations: [],
  },
  metaRecommender: {
    readOnly: true,
    qaMarker: GROWTH_META_RECOMMENDER_QA_MARKER,
    generatedAt,
    rule: "read-only",
    rankingFormula: "test",
    recommendations: [],
    topRecommendations: [
      {
        id: "meta-1",
        organizationId: "org-3a-cert",
        scope: "lead",
        subjectId: "lead-1",
        recommendationType: "prepare_outreach",
        title: "Prepare outreach",
        summary: "Lead ready for outreach prep",
        confidence: 80,
        urgency: 70,
        impact: 75,
        effort: 20,
        score: 78,
        evidence: [{ source: "test", label: "Confidence", value: 80 }],
        policy: { requiresHumanApproval: true, autonomyCapability: "outreach_preparation" },
        suggestedAction: { label: "Review", actionType: "prepare_outreach", requiresHumanApproval: true },
      },
    ],
    summary: { total: 1, requiringApproval: 1, byScope: { lead: 1 } },
    sourcesIncluded: ["test"],
    sourcesFailed: [],
    revenueOperatorBinding: { readOnly: true, summary: "aligned", topRecommendationIds: ["meta-1"], alignedOrchestrationIds: [] },
  },
  priorityBinding: {
    readOnly: true,
    qaMarker: GROWTH_PRIORITY_ENGINE_BINDING_QA_MARKER,
    generatedAt,
    rule: "read-only",
    rankingFormula: "test",
    topBindings: [],
    bindings: [],
    objectiveContexts: [],
    sourcesIncluded: [],
    sourcesFailed: [],
    summary: { total: 0, starved: 0, needsApproval: 0, blocked: 0, byStatus: {} },
    revenueOperatorBinding: { readOnly: true, summary: "none", topBindingIds: [], alignedOrchestrationIds: [] },
  },
  humanApprovalCenter: {
    readOnly: true,
    qaMarker: GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER,
    generatedAt,
    rule: "read-only",
    rankingFormula: "test",
    items: [],
    topItems: [],
    summary: {
      totalPending: 3,
      smsPending: 0,
      emailPending: 1,
      voicePending: 0,
      highestRiskTitle: "Approve outreach",
      highestRiskLevel: "high",
      approvalCenterHref: "/growth/os/approvals",
    },
    filterCounts: { byChannel: {}, bySource: {}, byActionType: {}, byRiskLevel: {} },
    sourcesIncluded: [],
    sourcesFailed: [],
  },
  communicationEngine: {
    readOnly: true,
    qaMarker: GROWTH_COMMUNICATION_ENGINE_QA_MARKER,
    generatedAt,
    rule: "read-only",
    rankingFormula: "test",
    summary: { plansGenerated: 1, primaryStrategy: "email_first", blockedChannelCount: 0, averageConfidence: 70, topChannel: "email" },
    plans: [],
  },
  boundedAutonomousOutbound: {
    readOnly: true,
    qaMarker: GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER,
    generatedAt,
    rule: "read-only",
    summary: { approvedScopes: 0, activeScopes: 1, blockedScopes: 0, pausedScopes: 0, actionsExecutedToday: 2, actionsBlockedToday: 0 },
    approvedScopes: [],
    activeScopes: [],
    blockedScopes: [],
    recentActions: [],
    stopConditionTriggers: [],
    killSwitchStatus: { autonomyEnabled: true, autonomyOutboundEnabled: true, emergencyStopActive: false },
    channelMixToday: { email: 1, sms: 1, voice_drop: 0, ai_voice: 0, linkedin_manual: 0, video: 0 },
    lastEventAt: null,
    lastEventType: null,
  },
  eventBusHealth: {
    readOnly: true,
    qaMarker: GROWTH_AI_EVENT_BUS_QA_MARKER,
    generatedAt,
    recentEventCount: 1,
    lastEventAt: generatedAt,
    lastEventType: "growth.workflow.status_changed",
    registeredSubscribers: 10,
    subscriberHealth: [],
    droppedEvents: 0,
    bridgeSourcesWired: [],
  },
  autonomyPolicy,
  operationsDashboard: {
    readOnly: true,
    qaMarker: GROWTH_AI_OS_OPERATIONS_DASHBOARD_QA_MARKER,
    generatedAt,
    executiveOverview: {
      dailyBriefingHeadline: "Cert",
      dailyBriefingSummary: "Summary",
      aiHealthStatus: "healthy",
      aiHealthLabel: "Healthy",
      activeAutonomousRuns: 0,
      needsAttentionCount: 1,
      approvalBacklogCount: 3,
      priorityWorkLabel: "Review",
      safeModeLabel: "Off",
      operatingModeLabel: "Read-only",
    },
    autonomyState: {
      operatingModeLabel: "Read-only",
      autonomyEnabled: true,
      emergencyStopActive: false,
      shadowModeEnabled: false,
      activeAutonomousAgents: [],
      controlPlaneHref: "/growth/os/autonomy",
    },
    executionAgentStatus: { label: "Idle", detail: "Cert", status: "idle" },
    outreachAgentStatus: { label: "Idle", detail: "Cert", status: "idle" },
    meetingAgentStatus: { label: "Idle", detail: "Cert", status: "idle" },
    activeWork: [],
    activityTimeline: [],
    healthSummary: {
      agentHealthLabel: "Healthy",
      providerHealthLabel: "Healthy",
      schedulerReadinessLabel: "Ready",
      budgetUsageLabel: "Low",
      safeModeLabel: "Off",
      blockedAgentsCount: 0,
    },
    approvalSummary: { totalCount: 3, categories: [] },
    missionPriorities: [],
    activeObjectives: [],
    engineeringDiagnostics: [],
    dailyBriefing: { headline: "Cert", summary: "Summary", sections: [] },
  },
} as GrowthRevenueDirectorCommandCenterSnapshot

const readModelA = synthesizeGrowthRevenueDirectorReadModel({
  organizationId: "org-3a-cert",
  snapshot: emptySnapshot,
})
const readModelB = synthesizeGrowthRevenueDirectorReadModel({
  organizationId: "org-3a-cert",
  snapshot: emptySnapshot,
})

assert.equal(readModelA.qaMarker, GROWTH_REVENUE_DIRECTOR_QA_MARKER)
assert.deepEqual(
  readModelA.workflowRequests.map((row) => row.id),
  readModelB.workflowRequests.map((row) => row.id),
)
assert.ok(readModelA.workflowRequests.every((row) => row.advisory === true))
assert.ok(readModelA.workflowRequests.some((row) => row.requestType === "generate_outreach"))
assert.ok(readModelA.workflowRequests.some((row) => row.requestType === "review_approval_queue"))
assert.equal(readModelA.executiveSummary.shouldIntervene, true)
assert.equal(readModelA.kpis.approvalBacklog, 3)
assert.equal(readModelA.eventObservation.subscriberId, "revenue_director_observer")

const emergencySnapshot = {
  ...emptySnapshot,
  autonomyPolicy: buildGrowthAiOsAutonomyPolicyReadModel({
    organizationId: "org-3a-cert",
    generatedAt,
    settings: {
      ...settingsWithKillSwitches,
      killSwitches: {
        ...settingsWithKillSwitches.killSwitches,
        autonomyEnabled: false,
      },
    },
    runtimeEnabled: false,
    runtimePilotEnabled: false,
  }),
}
const emergencyModel = synthesizeGrowthRevenueDirectorReadModel({
  organizationId: "org-3a-cert",
  snapshot: emergencySnapshot,
})
assert.equal(emergencyModel.executiveSummary.revenueHealth, "blocked")
assert.equal(emergencyModel.executiveSummary.shouldPauseOutbound, true)
assert.ok(emergencyModel.workflowRequests.some((row) => row.requestType === "pause_objective"))

assert.ok(extractGrowthRevenueDirectorSnapshot({
  ...emptySnapshot,
  readOnly: true,
  qaMarker: GROWTH_AI_OS_COMMAND_CENTER_QA_MARKER,
} as never).generatedAt === generatedAt)

for (const file of [
  "lib/growth/aios/revenue-director/growth-revenue-director-engine.ts",
  "lib/growth/aios/revenue-director/growth-revenue-director-service.ts",
  "lib/growth/aios/ai-os-command-center-service.ts",
]) {
  assertNoCoreTouch(file, ["public.invoices", "public.quotes", "transitionAiWorkOrder"])
}

const regressionScripts = [
  "test:prod-regression-6-command-center-import-stability",
  "test:ge-ai-2b-event-bus-completion",
  "test:ge-ai-2e-priority-engine-binding",
  "test:ge-ai-2h-human-approval-center",
    "test:ge-ai-2f-meta-recommender",
]
for (const script of regressionScripts) {
  execSync(`pnpm ${script}`, { stdio: "inherit", cwd: process.cwd() })
}

console.log(`[${GROWTH_AIOS_GE_AI_3A_PHASE}] PASS — Revenue Director foundation certified (local)`)

