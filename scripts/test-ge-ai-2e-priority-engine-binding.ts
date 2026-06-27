/**
 * GE-AI-2E — Priority Engine Binding certification.
 * Run: pnpm test:ge-ai-2e-priority-engine-binding
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_AI_OS_COMMAND_CENTER_QA_MARKER } from "../lib/growth/aios/ai-os-command-center-types"
import { GROWTH_MISSION_PRIORITY_QA_MARKER } from "../lib/growth/aios/growth/growth-mission-priority-types"
import { buildDefaultGrowthAutonomySettings } from "../lib/growth/autonomy/growth-autonomy-config"
import { buildGrowthAiOsAutonomyPolicyReadModel } from "../lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"
import {
  buildBindingFromRankedMission,
  rankGrowthPriorityBindings,
  synthesizeGrowthPriorityEngineBindingReadModel,
} from "../lib/growth/aios/priority/growth-priority-engine-binding-engine"
import {
  GROWTH_AIOS_GE_AI_2E_PHASE,
  GROWTH_PRIORITY_ENGINE_BINDING_QA_MARKER,
  GROWTH_PRIORITY_ENGINE_BINDING_RANKING_FORMULA,
  GROWTH_PRIORITY_ENGINE_BINDING_RULE,
} from "../lib/growth/aios/priority/growth-priority-engine-binding-types"
import { GROWTH_META_RECOMMENDER_QA_MARKER } from "../lib/growth/aios/recommendations/growth-meta-recommender-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string, forbidden: string[]): void {
  const source = readSource(relativePath)
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

console.log(`[${GROWTH_AIOS_GE_AI_2E_PHASE}] Priority Engine Binding certification`)

assert.equal(GROWTH_PRIORITY_ENGINE_BINDING_QA_MARKER, "growth-ge-ai-2e-priority-engine-binding-v1")
assert.ok(GROWTH_PRIORITY_ENGINE_BINDING_RULE.includes("read-only"))
assert.ok(GROWTH_PRIORITY_ENGINE_BINDING_RANKING_FORMULA.includes("overallPriority"))

const requiredFiles = [
  "lib/growth/aios/priority/growth-priority-engine-binding-types.ts",
  "lib/growth/aios/priority/growth-priority-engine-binding-engine.ts",
  "lib/growth/aios/priority/growth-priority-engine-binding-service.ts",
  "app/api/platform/growth/ai-os/priority-bindings/route.ts",
  "components/growth/ai-os/command-center/growth-ai-os-priority-binding-section.tsx",
  "docs/GE-AI-2E_PRIORITY_ENGINE_BINDING.md",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
}

const service = readSource("lib/growth/aios/priority/growth-priority-engine-binding-service.ts")
assert.ok(service.includes('import "server-only"'))
assert.ok(service.includes("buildGrowthPriorityEngineBindingReadModel"))
assert.equal(service.includes("transitionAiWorkOrder"), false)
assert.equal(service.includes("send-sms"), false)

const engine = readSource("lib/growth/aios/priority/growth-priority-engine-binding-engine.ts")
assert.equal(engine.includes('import "server-only"'), false)
assert.ok(engine.includes("synthesizeGrowthPriorityEngineBindingReadModel"))
assert.ok(engine.includes("GROWTH_PRIORITY_BINDING_SOURCE_COLLECTORS"))

const commandCenterService = readSource("lib/growth/aios/ai-os-command-center-service.ts")
assert.ok(commandCenterService.includes("buildGrowthPriorityEngineBindingReadModel"))
assert.ok(commandCenterService.includes("priorityBinding"))

const commandCenterTypes = readSource("lib/growth/aios/ai-os-command-center-types.ts")
assert.ok(commandCenterTypes.includes("priorityBinding: GrowthPriorityEngineBindingReadModel"))

const route = readSource("app/api/platform/growth/ai-os/priority-bindings/route.ts")
assert.ok(route.includes("requireGrowthEnginePlatformAccess(request)"))
assert.equal(route.includes("POST"), false)
assert.equal(route.includes("PUT"), false)

const panel = readSource("components/growth/ai-os/command-center/growth-ai-os-command-center-panel.tsx")
assert.ok(panel.includes("priorityBinding={model.priorityBinding}"))

const operationsUi = readSource("components/growth/ai-os/operations/growth-ai-os-operations-dashboard.tsx")
assert.ok(operationsUi.includes("GrowthAiOsPriorityBindingSection"))

const priorityUi = readSource("components/growth/ai-os/command-center/growth-ai-os-priority-binding-section.tsx")
assert.equal(priorityUi.includes('method: "POST"'), false)
assert.equal(priorityUi.includes("Approve"), false)
assert.ok(priorityUi.includes("Approval required"))

const objectivesUi = readSource("components/growth/objectives/growth-objectives-dashboard.tsx")
assert.ok(objectivesUi.includes("objective-priority-binding"))
assert.ok(objectivesUi.includes("/api/growth/workspace/objectives/priority-binding"))

const generatedAt = "2026-06-25T14:00:00.000Z"
const policy = buildGrowthAiOsAutonomyPolicyReadModel({
  organizationId: "org-2e-cert",
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

const rankedMission = {
  missionId: "mission-lead-1-qualify_lead",
  missionType: "qualify_lead" as const,
  leadId: "lead-1",
  companyName: "Acme Medical",
  capacityKind: "qualification_capacity" as const,
  allocationStatus: "waiting_for_human" as const,
  queueBucket: "immediate" as const,
  priority: {
    priorityScore: 88,
    urgencyScore: 90,
    businessValueScore: 85,
    confidenceScore: 80,
    effortScore: 40,
    estimatedRoi: 0.72,
    missionAgeDays: 2,
    slaPressure: 75,
    dependencyWeight: 60,
    strategicImportance: 72,
    overallPriority: 91,
    explanation: "High-value lead awaiting qualification.",
    recommendedOrder: 1,
  },
  blockers: ["Approval pending"],
  recommendedAction: "Run qualification workflow after human approval.",
  deferReason: null,
  allocationReason: "Immediate queue — high ROI",
}

const bindingA = buildBindingFromRankedMission({
  organizationId: "org-2e-cert",
  generatedAt,
  ranked: rankedMission,
  priorityRank: 1,
  objectives: [
    {
      id: "objective-1",
      organizationId: "org-2e-cert",
      title: "Book demos",
      description: null,
      objectiveType: "demos_booked",
      targetValue: 20,
      currentValue: 3,
      startDate: null,
      targetDate: null,
      status: "active",
      ownerUserId: null,
      priority: "high",
      autonomyLevel: "objective",
      safetyMode: "strict",
      plan: null,
      runtime: { running: true } as never,
      recentSignals: [{ id: "sig-1", leadId: "lead-1", type: "engagement_open", receivedAt: generatedAt }],
      adaptiveRecommendations: [],
      executionHistory: [],
      eventSubscriptions: [],
      emergencyStopActive: false,
      createdAt: generatedAt,
      updatedAt: generatedAt,
    },
  ],
  approvalWorkOrders: [
    {
      workOrderId: "wo-1",
      missionId: "objective-1",
      workOrderType: "planning_review",
      status: "awaiting_approval",
      assignedAgent: "planning_agent",
      priority: 800,
      updatedAt: generatedAt,
      planningReviewHref: "/growth/os/missions/objective-1/planning",
    },
  ],
  starvationIssues: [],
  metaRecommendations: [
    {
      id: "meta-rec-1",
      organizationId: "org-2e-cert",
      scope: "lead",
      subjectId: "lead-1",
      recommendationType: "qualify",
      title: "Qualify Acme Medical",
      summary: "Meta-recommender agrees — qualify next.",
      confidence: 85,
      urgency: 90,
      impact: 88,
      effort: 40,
      score: 82,
      evidence: [{ source: "mission_priority", label: "Queue bucket", value: "immediate" }],
      policy: { requiresHumanApproval: true },
      createdAt: generatedAt,
    },
  ],
  orchestrations: [
    {
      orchestrationId: "orch-1",
      evaluationTimestamp: generatedAt,
      leadId: "lead-1",
      companyId: null,
      companyName: "Acme Medical",
      currentLifecycleStage: "qualification",
      owningAgent: "research_agent",
      candidateAgents: ["qualification_agent"],
      orchestrationDecision: "handoff_to_qualification",
      recommendedNextAgent: "qualification_agent",
      confidence: 0.88,
      reasoning: "Research complete — hand off to qualification.",
      requiredGates: [],
      blockedReasons: [],
      escalationLevel: "medium",
      recommendedNextAction: "Hand off to Qualification Agent",
      handoffPreview: null,
    },
  ],
  policyContext: {
    emergencyStopActive: policy.emergencyStopActive,
    autonomyEnabled: policy.autonomyEnabled,
  },
})

assert.equal(bindingA.objectiveId, "objective-1")
assert.equal(bindingA.status, "needs_approval")
assert.ok(bindingA.evidence.length >= 3)
assert.ok(bindingA.blockers.some((blocker) => blocker.type === "approval"))
assert.equal(bindingA.sourceRecommendationId, "meta-rec-1")
assert.equal(bindingA.recommendedNextStep, "run_qualification")

const readModelA = synthesizeGrowthPriorityEngineBindingReadModel({
  organizationId: "org-2e-cert",
  generatedAt,
  objectives: [
    {
      id: "objective-1",
      organizationId: "org-2e-cert",
      title: "Book demos",
      description: null,
      objectiveType: "demos_booked",
      targetValue: 20,
      currentValue: 3,
      startDate: null,
      targetDate: null,
      status: "active",
      ownerUserId: null,
      priority: "high",
      autonomyLevel: "objective",
      safetyMode: "strict",
      plan: null,
      runtime: { running: true } as never,
      recentSignals: [{ id: "sig-1", leadId: "lead-1", type: "engagement_open", receivedAt: generatedAt }],
      adaptiveRecommendations: [],
      executionHistory: [],
      eventSubscriptions: [],
      emergencyStopActive: false,
      createdAt: generatedAt,
      updatedAt: generatedAt,
    },
  ],
  activeMissions: [
    {
      missionId: "objective-1",
      title: "Book demos",
      status: "active",
      objectiveType: "demos_booked",
      currentStageId: "research",
      running: true,
      progressPercent: 15,
      activeWorkOrderCount: 1,
      planningReviewHref: "/growth/os/missions/objective-1/planning",
    },
  ],
  approvalWorkOrders: [],
  missionPriority: {
    qaMarker: GROWTH_MISSION_PRIORITY_QA_MARKER,
    generatedAt,
    rule: "read-only",
    schedulerActive: false,
    summary: {
      missionsRanked: 1,
      immediate: 1,
      today: 0,
      deferred: 0,
      blocked: 0,
      abandonRecommended: 0,
      starvationIssues: 1,
    },
    capacityPool: [],
    rankedMissions: [rankedMission],
    queues: { immediate: [rankedMission], today: [], this_week: [], backlog: [], archive_candidate: [] },
    starvationIssues: [
      {
        issueId: "starve-1",
        kind: "long_waiting",
        missionId: rankedMission.missionId,
        leadId: "lead-1",
        summary: "Mission waiting beyond SLA threshold.",
        recommendedRemediation: "Escalate or reallocate capacity.",
      },
    ],
    revenueOperatorGuidance: {
      highestValueWork: "Qualify lead-1",
      shouldHappenToday: "Qualify lead-1",
      canSafelyWait: "Backlog missions",
      shouldAbandon: "None",
      capacitySpend: "Qualification capacity",
    },
  },
  metaRecommendations: [
    {
      id: "meta-rec-1",
      organizationId: "org-2e-cert",
      scope: "lead",
      subjectId: "lead-1",
      recommendationType: "qualify",
      title: "Qualify Acme Medical",
      summary: "Meta-recommender agrees — qualify next.",
      confidence: 85,
      urgency: 90,
      impact: 88,
      effort: 40,
      score: 82,
      evidence: [{ source: "mission_priority", label: "Queue bucket", value: "immediate" }],
      policy: { requiresHumanApproval: true },
      createdAt: generatedAt,
    },
  ],
  orchestrations: [],
})

const readModelB = synthesizeGrowthPriorityEngineBindingReadModel({
  organizationId: "org-2e-cert",
  generatedAt,
  objectives: readModelA.objectiveContexts.map((ctx) => ({
    id: ctx.objectiveId,
    organizationId: "org-2e-cert",
    title: ctx.title,
    description: null,
    objectiveType: "demos_booked",
    targetValue: 20,
    currentValue: 3,
    startDate: null,
    targetDate: null,
    status: "active",
    ownerUserId: null,
    priority: "high",
    autonomyLevel: "objective",
    safetyMode: "strict",
    plan: null,
    runtime: { running: ctx.running } as never,
    recentSignals: [{ id: "sig-1", leadId: "lead-1", type: "engagement_open", receivedAt: generatedAt }],
    adaptiveRecommendations: [],
    executionHistory: [],
    eventSubscriptions: [],
    emergencyStopActive: false,
    createdAt: generatedAt,
    updatedAt: generatedAt,
  })),
  activeMissions: [
    {
      missionId: "objective-1",
      title: "Book demos",
      status: "active",
      objectiveType: "demos_booked",
      currentStageId: "research",
      running: true,
      progressPercent: 15,
      activeWorkOrderCount: 1,
      planningReviewHref: "/growth/os/missions/objective-1/planning",
    },
  ],
  approvalWorkOrders: [],
  missionPriority: {
    qaMarker: GROWTH_MISSION_PRIORITY_QA_MARKER,
    generatedAt,
    rule: "read-only",
    schedulerActive: false,
    summary: {
      missionsRanked: 1,
      immediate: 1,
      today: 0,
      deferred: 0,
      blocked: 0,
      abandonRecommended: 0,
      starvationIssues: 1,
    },
    capacityPool: [],
    rankedMissions: [rankedMission],
    queues: { immediate: [rankedMission], today: [], this_week: [], backlog: [], archive_candidate: [] },
    starvationIssues: [
      {
        issueId: "starve-1",
        kind: "long_waiting",
        missionId: rankedMission.missionId,
        leadId: "lead-1",
        summary: "Mission waiting beyond SLA threshold.",
        recommendedRemediation: "Escalate or reallocate capacity.",
      },
    ],
    revenueOperatorGuidance: {
      highestValueWork: "Qualify lead-1",
      shouldHappenToday: "Qualify lead-1",
      canSafelyWait: "Backlog missions",
      shouldAbandon: "None",
      capacitySpend: "Qualification capacity",
    },
  },
  metaRecommendations: [
    {
      id: "meta-rec-1",
      organizationId: "org-2e-cert",
      scope: "lead",
      subjectId: "lead-1",
      recommendationType: "qualify",
      title: "Qualify Acme Medical",
      summary: "Meta-recommender agrees — qualify next.",
      confidence: 85,
      urgency: 90,
      impact: 88,
      effort: 40,
      score: 82,
      evidence: [{ source: "mission_priority", label: "Queue bucket", value: "immediate" }],
      policy: { requiresHumanApproval: true },
      createdAt: generatedAt,
    },
  ],
  orchestrations: [],
})

assert.equal(readModelA.qaMarker, GROWTH_PRIORITY_ENGINE_BINDING_QA_MARKER)
assert.ok(readModelA.topBindings.length > 0)
assert.ok(readModelA.bindings.some((row) => row.status === "starved"))
assert.ok(readModelA.objectiveContexts.some((row) => row.objectiveId === "objective-1"))
assert.deepEqual(
  readModelA.topBindings.map((row) => row.id),
  readModelB.topBindings.map((row) => row.id),
)
assert.ok(rankGrowthPriorityBindings(readModelA.bindings)[0].priorityScore >= readModelA.bindings.at(-1)!.priorityScore)

const resilient = synthesizeGrowthPriorityEngineBindingReadModel({
  organizationId: "org-2e-cert",
  generatedAt,
  objectives: [],
  activeMissions: [
    {
      missionId: "objective-orphan",
      title: "Orphan objective",
      status: "active",
      objectiveType: "demos_booked",
      currentStageId: "research",
      running: true,
      progressPercent: 10,
      activeWorkOrderCount: 0,
      planningReviewHref: "/growth/os/missions/objective-orphan/planning",
    },
  ],
  approvalWorkOrders: [],
  missionPriority: {
    qaMarker: GROWTH_MISSION_PRIORITY_QA_MARKER,
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
    get rankedMissions() {
      throw new Error("simulated mission priority failure")
    },
    queues: { immediate: [], today: [], this_week: [], backlog: [], archive_candidate: [] },
    starvationIssues: [],
    revenueOperatorGuidance: {
      highestValueWork: "None",
      shouldHappenToday: "None",
      canSafelyWait: "All",
      shouldAbandon: "None",
      capacitySpend: "None",
    },
  } as never,
  metaRecommendations: [],
  orchestrations: [],
})

assert.ok(resilient.sourcesFailed.some((row) => row.source === "mission_priority.ranked_missions"))

for (const file of [
  "lib/growth/aios/priority/growth-priority-engine-binding-engine.ts",
  "lib/growth/aios/priority/growth-priority-engine-binding-service.ts",
  "lib/growth/aios/ai-os-command-center-service.ts",
]) {
  assertNoCoreTouch(file, ["public.invoices", "public.quotes", "send-sms", "transitionAiWorkOrder"])
}

assert.equal(readSource("lib/growth/aios/priority/growth-priority-engine-binding-engine.ts").includes("schedulerActive: true"), false)

const regressionScripts = [
  "test:ge-ai-2f-meta-recommender",
  "test:prod-regression-6-command-center-import-stability",
  "test:ge-aios-5c-command-center-read-model-foundation",
]
for (const script of regressionScripts) {
  execSync(`pnpm ${script}`, { stdio: "inherit", cwd: process.cwd() })
}

console.log(`[${GROWTH_AIOS_GE_AI_2E_PHASE}] PASS — Priority Engine Binding certified (local)`)

