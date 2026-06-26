/**
 * GE-AIOS-CONSOLIDATION-1C — Growth Autonomy Control Plane certification.
 * Run: pnpm test:ge-aios-consolidation-1c-autonomy-control-plane
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_AGENT_KINDS } from "../lib/growth/aios/growth/growth-agent-framework-types"
import type { AiOsCommandCenterReadModel } from "../lib/growth/aios/ai-os-command-center-types"
import { GROWTH_AI_OS_COMMAND_CENTER_QA_MARKER } from "../lib/growth/aios/ai-os-command-center-types"
import { synthesizeAiOsOperationsDashboard } from "../lib/growth/aios/ai-os-operations-dashboard-synthesizer"
import { GROWTH_AI_OS_OPERATIONS_DASHBOARD_QA_MARKER } from "../lib/growth/aios/ai-os-operations-dashboard-types"
import { buildDefaultGrowthAutonomySettings } from "../lib/growth/autonomy/growth-autonomy-config"
import {
  buildGrowthAiOsAutonomyPolicyReadModel,
  enrichAgentFrameworkWithAutonomyPolicy,
  enrichAutonomousResearchPilotWithAutonomyPolicy,
  enrichRevenueOperatorWithAutonomyPolicy,
  enrichSchedulerReadinessWithAutonomyPolicy,
  evaluateResearchPilotAutonomyPolicyGate,
  evaluateRuntimeAutonomyPolicyGate,
} from "../lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"
import {
  GROWTH_AIOS_CONSOLIDATION_1C_PHASE,
  GROWTH_AI_OS_AUTONOMY_CONTROL_PLANE_PATH,
  GROWTH_AI_OS_AUTONOMY_POLICY_QA_MARKER,
  GROWTH_AI_OS_AUTONOMY_POLICY_RULE,
} from "../lib/growth/autonomy/growth-ai-os-autonomy-policy-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string, forbidden: string[]): void {
  const source = readSource(relativePath)
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

console.log(`[${GROWTH_AIOS_CONSOLIDATION_1C_PHASE}] Autonomy Control Plane certification`)

assert.equal(GROWTH_AI_OS_AUTONOMY_POLICY_QA_MARKER, "growth-aios-consolidation-1c-autonomy-policy-v1")
assert.equal(GROWTH_AI_OS_AUTONOMY_CONTROL_PLANE_PATH, "/growth/settings/autonomy")
assert.ok(GROWTH_AI_OS_AUTONOMY_POLICY_RULE.includes("canonical"))
console.log("  ✓ Policy QA marker and control plane path")

const requiredFiles = [
  "lib/growth/autonomy/growth-ai-os-autonomy-policy-types.ts",
  "lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer.ts",
  "lib/growth/autonomy/growth-ai-os-autonomy-policy-engine-service.ts",
  "components/growth/autonomy/growth-autonomy-ai-os-integration-panel.tsx",
  "docs/GE-AIOS-CONSOLIDATION-1C_CERTIFICATION.md",
  "docs/GE-AIOS-CONSOLIDATION-1C_AUTONOMY_CONTROL_PLANE.md",
  "docs/GE-AIOS-CONSOLIDATION-1C_INFRASTRUCTURE_AUDIT.md",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
}
console.log("  ✓ Required files present")

const policyEngine = readSource("lib/growth/autonomy/growth-ai-os-autonomy-policy-engine-service.ts")
assert.ok(policyEngine.includes("fetchGrowthAiOsAutonomyPolicy"))
assert.ok(policyEngine.includes("buildGrowthAiOsAutonomyPolicyReadModel"))
assert.ok(policyEngine.includes("getRuntimeKillSwitchStates"))
assert.equal(policyEngine.includes("INSERT INTO"), false)
console.log("  ✓ Policy engine read-through service")

const schedulerService = readSource("lib/growth/aios/growth/growth-scheduler-readiness-service.ts")
assert.ok(schedulerService.includes("fetchGrowthAiOsAutonomyPolicy"))
assert.ok(schedulerService.includes("enrichSchedulerReadinessWithAutonomyPolicy"))
console.log("  ✓ Scheduler readiness service consumes policy engine")

const commandCenterService = readSource("lib/growth/aios/ai-os-command-center-service.ts")
assert.ok(commandCenterService.includes("fetchGrowthAiOsAutonomyPolicy"))
assert.ok(commandCenterService.includes("buildCommandCenterSafeModeFromPolicy"))
assert.ok(commandCenterService.includes("enrichAgentFrameworkWithAutonomyPolicy"))
assert.ok(commandCenterService.includes("enrichRevenueOperatorWithAutonomyPolicy"))
assert.ok(commandCenterService.includes("enrichAutonomousResearchPilotWithAutonomyPolicy"))
console.log("  ✓ Command Center consumes policy engine")

const runtimeLifecycle = readSource(
  "lib/growth/aios/growth/growth-lead-research-execution-runtime-lifecycle-service.ts",
)
assert.ok(runtimeLifecycle.includes("fetchGrowthAiOsAutonomyPolicy"))
assert.ok(runtimeLifecycle.includes("evaluateRuntimeAutonomyPolicyGate"))
console.log("  ✓ Execution runtime consults policy before validation")

const pilotService = readSource("lib/growth/aios/growth/growth-autonomous-research-pilot-service.ts")
assert.ok(pilotService.includes("fetchGrowthAiOsAutonomyPolicy"))
assert.ok(pilotService.includes("evaluateResearchPilotAutonomyPolicyGate"))
console.log("  ✓ Autonomous Research pilot cycle consults policy")

const autonomySettings = readSource("lib/growth/autonomy/growth-autonomy-settings-service.ts")
assert.ok(autonomySettings.includes("fetchGrowthAiOsAutonomyPolicy"))
assert.ok(autonomySettings.includes("buildAutonomyPolicyIntegrationSummary"))
assert.ok(autonomySettings.includes("syncAutonomousResearchPilotFromPolicy"))
console.log("  ✓ Growth Autonomy settings sync pilot from policy")

const controlCenterUi = readSource("components/growth/autonomy/growth-autonomy-control-center.tsx")
assert.ok(controlCenterUi.includes("GrowthAutonomyAiOsIntegrationPanel"))
assert.ok(controlCenterUi.includes('data-qa-section="autonomy-ai-os-integration"') === false)
assert.ok(controlCenterUi.includes("GrowthAutonomyAiOsIntegrationPanel"))
console.log("  ✓ Growth Autonomy control center wired to AI OS integration panel")

const integrationPanel = readSource("components/growth/autonomy/growth-autonomy-ai-os-integration-panel.tsx")
assert.ok(integrationPanel.includes('data-qa-section="autonomy-ai-os-integration"'))
console.log("  ✓ AI OS integration panel QA section")

const operationsUi = readSource("components/growth/ai-os/operations/growth-ai-os-operations-dashboard.tsx")
assert.ok(operationsUi.includes('qaSection="operations-autonomy-state"'))
assert.ok(operationsUi.includes("Configure in Growth Autonomy"))
assert.equal(operationsUi.includes("savePatch"), false)
assert.equal(operationsUi.includes("masterMode"), false)
console.log("  ✓ AI Operations autonomy summary read-only with deep link")

const pilotSection = readSource(
  "components/growth/ai-os/command-center/growth-ai-os-autonomous-research-pilot-section.tsx",
)
assert.ok(pilotSection.includes("Configure in Growth Autonomy"))
assert.equal(pilotSection.includes("Pause"), false)
assert.equal(pilotSection.includes("Resume"), false)
assert.equal(pilotSection.includes("Disable"), false)
console.log("  ✓ Pilot diagnostics read-only — no duplicate controls")

const commandCenterTypes = readSource("lib/growth/aios/ai-os-command-center-types.ts")
assert.ok(commandCenterTypes.includes("autonomyPolicy: GrowthAiOsAutonomyPolicyReadModel"))
console.log("  ✓ Command Center read model includes autonomyPolicy")

const defaultSettings = buildDefaultGrowthAutonomySettings("org-cert-1c")
const policy = buildGrowthAiOsAutonomyPolicyReadModel({
  organizationId: "org-cert-1c",
  generatedAt: "2026-06-25T12:00:00.000Z",
  settings: {
    ...defaultSettings,
    masterMode: "guardrailed",
    capabilityToggles: {
      ...defaultSettings.capabilityToggles,
      research: true,
      recommendations: true,
      task_creation: true,
    },
    killSwitches: {
      autonomyEnabled: true,
      autonomyOutboundEnabled: false,
      autonomyGenerationEnabled: false,
      autonomyObjectiveModeEnabled: false,
    },
  },
  runtimeEnabled: true,
  runtimePilotEnabled: false,
})

assert.equal(policy.qaMarker, GROWTH_AI_OS_AUTONOMY_POLICY_QA_MARKER)
assert.equal(policy.operatingMode, "guardrailed")
assert.equal(policy.agentStates.length, GROWTH_AGENT_KINDS.length)
assert.ok(policy.enabledAgents.length > 0)
assert.equal(evaluateRuntimeAutonomyPolicyGate(policy).allowed, true)
assert.equal(evaluateResearchPilotAutonomyPolicyGate(policy).allowed, true)

const blockedResearchPolicy = buildGrowthAiOsAutonomyPolicyReadModel({
  organizationId: "org-cert-1c",
  generatedAt: "2026-06-25T12:00:00.000Z",
  settings: {
    ...defaultSettings,
    masterMode: "guardrailed",
    capabilityToggles: {
      ...defaultSettings.capabilityToggles,
      research: false,
      task_creation: true,
    },
    killSwitches: {
      autonomyEnabled: true,
      autonomyOutboundEnabled: false,
      autonomyGenerationEnabled: false,
      autonomyObjectiveModeEnabled: false,
    },
  },
  runtimeEnabled: true,
  runtimePilotEnabled: false,
})

assert.equal(evaluateResearchPilotAutonomyPolicyGate(blockedResearchPolicy).allowed, false)
assert.equal(evaluateRuntimeAutonomyPolicyGate(blockedResearchPolicy).allowed, true)

const manualPolicy = buildGrowthAiOsAutonomyPolicyReadModel({
  organizationId: "org-cert-1c",
  generatedAt: "2026-06-25T12:00:00.000Z",
  settings: {
    ...defaultSettings,
    masterMode: "manual",
    capabilityToggles: {
      ...defaultSettings.capabilityToggles,
      research: true,
      task_creation: true,
    },
    killSwitches: {
      autonomyEnabled: true,
      autonomyOutboundEnabled: false,
      autonomyGenerationEnabled: false,
      autonomyObjectiveModeEnabled: false,
    },
  },
  runtimeEnabled: true,
  runtimePilotEnabled: false,
})

assert.equal(evaluateRuntimeAutonomyPolicyGate(manualPolicy).allowed, false)
console.log("  ✓ Deterministic policy evaluation gates")

const minimalCommandCenter = {
  readOnly: true as const,
  qaMarker: GROWTH_AI_OS_COMMAND_CENTER_QA_MARKER,
  generatedAt: "2026-06-25T12:00:00.000Z",
  autonomyPolicy: policy,
  executiveSummary: {
    headline: "Test",
    activeMissionCount: 0,
    pendingWorkOrderCount: 0,
    approvalRequiredCount: 0,
    blockedWorkOrderCount: 0,
    recentEventCount: 0,
    primaryFocus: null,
  },
  activeMissions: [],
  needsAttention: [],
  recentActivity: [],
  executiveBrainActivity: [],
  pendingWorkOrders: [],
  approvalWorkOrders: [],
  blockedWorkOrders: [],
  recentDecisionRecords: [],
  agentHealth: { agents: [], generatedAt: "2026-06-25T12:00:00.000Z" },
  providerHealth: { ready: true, providers: [], generatedAt: "2026-06-25T12:00:00.000Z" },
  pilotStatus: {
    featureEnabled: false,
    enableAiEvidence: false,
    activePilotMissions: 0,
    recentLeadIds: [],
    observationHrefTemplate: "/growth/os/pilot/lead-research/{leadId}",
  },
  growthLeadResearchWorkflow: {
    workflowKey: "growth_lead_research",
    featureEnabled: false,
    statusCounts: {},
    activeLeads: [],
    assessedLeads: [],
    qualifiedLeads: [],
    blockedLeads: [],
    recommendedNextActions: [],
  },
  executionPlanReviewQueue: [],
  approvedPlanReadinessQueue: [],
  futureExecutionHandoffContracts: [],
  executionBoundaryAudit: {
    readOnly: true,
    qaMarker: "growth-aios-growth-2a-execution-boundary-audit-v1",
    generatedAt: "2026-06-25T12:00:00.000Z",
    workflowReports: [],
    systemSummary: {
      workflowsAudited: 0,
      futureExecutionAllowedCount: 0,
      outboundRiskWorkflows: [],
      coreRiskWorkflows: [],
      planningOnlyWorkflows: [],
      notAllowedWorkflows: [],
      missingGlobalGuardrails: [],
      systemRiskLevel: "low",
      headline: "ok",
    },
    planBoundaries: [],
  },
  executionPreflightChecklist: {
    readOnly: true,
    qaMarker: "growth-aios-growth-2b-execution-preflight-checklist-v1",
    generatedAt: "2026-06-25T12:00:00.000Z",
    workflowChecklists: [],
    planChecklists: [],
    systemSummary: {
      workflowsChecked: 0,
      preflightPassedCount: 0,
      blockedCount: 0,
      notAllowedCount: 0,
      blockedWorkflows: [],
      headline: "ok",
    },
  },
  executionSimulation: {
    readOnly: true,
    qaMarker: "growth-aios-growth-2c-execution-simulation-v1",
    generatedAt: "2026-06-25T12:00:00.000Z",
    workflowSimulations: [],
    planSimulations: [],
    systemSummary: {
      simulationsGenerated: 0,
      successCount: 0,
      partialSuccessCount: 0,
      readyCount: 0,
      blockedCount: 0,
      failedPreflightCount: 0,
      notAllowedCount: 0,
      headline: "ok",
    },
  },
  executionRuntime: {
    qaMarker: "growth-aios-growth-3a-runtime-v1",
    generatedAt: "2026-06-25T12:00:00.000Z",
    runtimeEnabled: false,
    runtimeRule: "rule",
    dryRunRule: "rule",
    pilotSummary: {
      pilotEnabled: false,
      eligibleCount: 0,
      blockedCount: 0,
      headline: "ok",
    },
    pilotRule: "rule",
    pilotEligiblePlans: [],
    pilotBlockedPlans: [],
    dryRunEligiblePlans: [],
    executionAuditSummaries: [],
    systemSummary: {
      runtimeEnabled: false,
      queuedCount: 0,
      activeCount: 0,
      pausedCount: 0,
      completedCount: 0,
      failedCount: 0,
      cancelledCount: 0,
      headline: "ok",
    },
    queuedExecutions: [],
    activeExecutions: [],
    pausedExecutions: [],
    completedExecutions: [],
    failedExecutions: [],
    cancelledExecutions: [],
  },
  agentFramework: {
    qaMarker: "growth-aios-growth-4a-agent-framework-v1",
    generatedAt: "2026-06-25T12:00:00.000Z",
    rule: "rule",
    schedulerActive: false as const,
    agents: [],
    summary: {
      totalAgents: 0,
      disabledAgents: 0,
      definitionOnlyAgents: 0,
      dryRunEligibleAgents: 0,
      internalRuntimeEligibleAgents: 0,
      outboundBlockedAgents: 0,
      coreMutationBlockedAgents: 0,
    },
  },
  revenueOperator: {
    qaMarker: "growth-aios-growth-4b-revenue-operator-orchestration-v1",
    generatedAt: "2026-06-25T12:00:00.000Z",
    rule: "rule",
    supervisorAgent: "revenue_operator" as const,
    schedulerActive: false as const,
    summary: {
      leadsEvaluated: 0,
      humanReviewRequired: 0,
      blocked: 0,
      executionReady: 0,
    },
    orchestrations: [],
  },
  agentEvents: {
    qaMarker: "growth-aios-growth-4c-agent-events-v1",
    generatedAt: "2026-06-25T12:00:00.000Z",
    rule: "rule",
    schedulerActive: false as const,
    schedulingMode: "disabled" as const,
    schedulingDefinitions: [],
    summary: {
      totalEvents: 0,
      pending: 0,
      ignored: 0,
      blocked: 0,
      completedRecommendations: 0,
    },
    queue: { pending: [], ignored: [], blocked: [], completedRecommendations: [] },
    latestEvents: [],
  },
  agentMemory: {
    qaMarker: "growth-aios-growth-4d-agent-memory-v1",
    generatedAt: "2026-06-25T12:00:00.000Z",
    rule: "rule",
    summary: { leadsIndexed: 0, complete: 0, partial: 0, blocked: 0, conflictsDetected: 0 },
    leads: [],
  },
  missionFramework: {
    qaMarker: "growth-aios-growth-4e-mission-framework-v1",
    generatedAt: "2026-06-25T12:00:00.000Z",
    rule: "rule",
    schedulerActive: false as const,
    summary: {
      totalMissions: 0,
      active: 0,
      blocked: 0,
      completed: 0,
      stalled: 0,
      waitingForHuman: 0,
    },
    planner: {
      activeMissions: [],
      completedMissions: [],
      stalledMissions: [],
      recommendedNewMissions: [],
      recommendedRetiringMissions: [],
    },
    missions: [],
  },
  missionPriority: {
    qaMarker: "growth-aios-growth-4f-mission-priority-v1",
    generatedAt: "2026-06-25T12:00:00.000Z",
    rule: "rule",
    schedulerActive: false as const,
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
    queues: {
      immediate: [],
      today: [],
      this_week: [],
      backlog: [],
      archive_candidate: [],
    },
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
    qaMarker: "growth-aios-growth-5a-scheduler-readiness-v1",
    generatedAt: "2026-06-25T12:00:00.000Z",
    rule: "rule",
    schedulerActive: false as const,
    phaseAllowedModes: [],
    readiness: {
      activationStatus: "not_configured",
      schedulerMode: "disabled",
      killSwitchStatus: {
        emergencyStop: "armed",
        autonomyDisabled: "armed",
        schedulerActive: false,
      },
      budgetControls: [],
      agentPermissionChecks: [],
      runtimeRiskChecks: [],
      outboundRiskChecks: [],
      blockedReasons: [],
      starvationWarnings: [],
      activationPlanSummary: "",
    },
    priorityQueue: { source: "mission_priority", buckets: {}, headline: "" },
    agentWakeRules: [],
    summary: {
      activationStatus: "not_configured",
      schedulerMode: "disabled",
      wakeRulesDefined: 0,
      blockedReasonCount: 0,
      starvationWarningCount: 0,
    },
  },
  autonomousResearchPilot: {
    qaMarker: "growth-aios-growth-5b-autonomous-research-pilot-v1",
    generatedAt: "2026-06-25T12:00:00.000Z",
    rule: "rule",
    agentKind: "research_agent" as const,
    schedulerMode: "controlled_agent_wake" as const,
    controlState: "active" as const,
    enabled: true,
    otherAgentsDisabled: true as const,
    budgetLimits: { maxRunsPerHour: 10, maxRunsPerDay: 100 },
    telemetry: {
      successfulRuns: 0,
      failedRuns: 0,
      skippedRuns: 0,
      averageDurationMs: 0,
      averageConfidence: 0,
      budgetConsumptionHour: 0,
      budgetConsumptionDay: 0,
      staleResearchResolved: 0,
      activeRuns: 0,
    },
    latestRefreshes: [],
    recentRuns: [],
    revenueOperatorSupervision: {
      approveWakeRecommendation: "",
      budgetMonitorSummary: "",
      failureMonitorSummary: "",
      pauseRecommendation: null,
      escalationRecommendation: null,
    },
    wakeConditionsSupported: [],
  },
  autonomousQualificationPilot: {
    qaMarker: "growth-aios-growth-5c-autonomous-qualification-pilot-v1",
    generatedAt: "2026-06-25T12:00:00.000Z",
    rule: "rule",
    agentKind: "qualification_agent" as const,
    schedulerMode: "controlled_agent_wake" as const,
    controlState: "disabled" as const,
    enabled: false,
    disabledAgentKinds: ["meeting_agent"],
    budgetLimits: { maxRunsPerHour: 20, maxRunsPerDay: 200, maxRetriesPerLeadPerDay: 3, cooldownAfterFailureMinutes: 30 },
    telemetry: {
      successfulRuns: 0,
      failedRuns: 0,
      skippedRuns: 0,
      eligibleLeads: 0,
      averageDurationMs: 0,
      averageConfidence: 0,
      budgetConsumptionHour: 0,
      budgetConsumptionDay: 0,
      activeRuns: 0,
    },
    latestDecisions: [],
    recentRuns: [],
    revenueOperatorSupervision: {
      approveWakeRecommendation: "",
      budgetMonitorSummary: "",
      failureMonitorSummary: "",
      pauseRecommendation: null,
      escalationRecommendation: null,
      latestHandoffRecommendation: null,
    },
    wakeConditionsSupported: [],
  },
  autonomousPlanningPilot: {
    qaMarker: "growth-aios-growth-5d-autonomous-planning-pilot-v1",
    generatedAt: "2026-06-25T12:00:00.000Z",
    rule: "rule",
    agentKind: "planning_agent" as const,
    schedulerMode: "controlled_agent_wake" as const,
    controlState: "disabled" as const,
    enabled: false,
    disabledAgentKinds: ["meeting_agent"],
    budgetLimits: { maxRunsPerHour: 15, maxRunsPerDay: 150, maxRetriesPerLeadPerDay: 2, cooldownAfterFailureMinutes: 30 },
    telemetry: {
      successfulRuns: 0,
      failedRuns: 0,
      skippedRuns: 0,
      eligibleLeads: 0,
      plansGenerated: 0,
      blockedPlanning: 0,
      averageDurationMs: 0,
      averageConfidence: 0,
      budgetConsumptionHour: 0,
      budgetConsumptionDay: 0,
      activeRuns: 0,
    },
    latestPlans: [],
    recentRuns: [],
    revenueOperatorSupervision: {
      approveWakeRecommendation: "",
      budgetMonitorSummary: "",
      failureMonitorSummary: "",
      pauseRecommendation: null,
      escalationRecommendation: null,
      latestHandoffRecommendation: null,
    },
    wakeConditionsSupported: [],
  },
  autonomousExecutionPilot: {
    qaMarker: "growth-aios-growth-5e-autonomous-execution-pilot-v1",
    generatedAt: "2026-06-25T12:00:00.000Z",
    rule: "rule",
    agentKind: "execution_agent" as const,
    schedulerMode: "controlled_agent_wake" as const,
    controlState: "disabled" as const,
    enabled: false,
    allowedWorkflow: "research_company" as const,
    disabledAgentKinds: ["outreach_agent", "meeting_agent"],
    budgetLimits: {
      maxRunsPerHour: 5,
      maxRunsPerDay: 25,
      maxRetriesPerPlanPerDay: 2,
      cooldownAfterFailureMinutes: 30,
    },
    telemetry: {
      successfulRuns: 0,
      failedRuns: 0,
      skippedRuns: 0,
      eligiblePlans: 0,
      queuedExecutions: 0,
      activeExecutions: 0,
      completedExecutions: 0,
      failedExecutions: 0,
      blockedExecutions: 0,
      budgetConsumptionHour: 0,
      budgetConsumptionDay: 0,
      activeRuns: 0,
    },
    latestExecutions: [],
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
    qaMarker: "growth-aios-growth-5f-autonomous-outreach-preparation-pilot-v1",
    generatedAt: "2026-06-25T12:00:00.000Z",
    rule: "rule",
    agentKind: "outreach_agent" as const,
    schedulerMode: "controlled_agent_wake" as const,
    controlState: "disabled" as const,
    enabled: false,
    preparationModeOnly: true as const,
    allowedWorkflow: "outreach_generation" as const,
    disabledAgentKinds: ["meeting_agent"],
    budgetLimits: {
      maxRunsPerHour: 20,
      maxRunsPerDay: 200,
      maxRetriesPerLeadPerDay: 3,
      cooldownAfterFailureMinutes: 30,
    },
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
  safeMode: {
    emergencyStopActive: false,
    objectiveModeEnabled: false,
    autonomyEnabled: true,
    killSwitches: {},
  },
  dailyBriefing: {
    readOnly: true,
    qaMarker: "growth-aios-5d-daily-briefing-v1",
    briefingId: "test",
    generatedAt: "2026-06-25T12:00:00.000Z",
    executiveHeadline: "Headline",
    whatChangedSummary: "Summary",
    topPriorities: [],
    needsApproval: [],
    blockers: [],
    recentWins: [],
    risks: [],
    recommendedNextActions: [],
    suggestedLinks: [],
  },
} satisfies Partial<AiOsCommandCenterReadModel> as AiOsCommandCenterReadModel

const enrichedFramework = enrichAgentFrameworkWithAutonomyPolicy(
  minimalCommandCenter.agentFramework,
  policy,
)
assert.equal(enrichedFramework.autonomyPolicySource, GROWTH_AI_OS_AUTONOMY_POLICY_QA_MARKER)
assert.ok(enrichedFramework.agentAutonomyPolicy?.length === GROWTH_AGENT_KINDS.length)

const enrichedScheduler = enrichSchedulerReadinessWithAutonomyPolicy(
  minimalCommandCenter.schedulerReadiness,
  policy,
)
assert.equal(enrichedScheduler.autonomyPolicySource, GROWTH_AI_OS_AUTONOMY_POLICY_QA_MARKER)
assert.equal(enrichedScheduler.policySchedulerMode, policy.schedulerMode)

const enrichedRevenue = enrichRevenueOperatorWithAutonomyPolicy(
  minimalCommandCenter.revenueOperator,
  policy,
)
assert.ok(enrichedRevenue.autonomyPolicyAwareness)

const enrichedPilot = enrichAutonomousResearchPilotWithAutonomyPolicy(
  minimalCommandCenter.autonomousResearchPilot,
  policy,
)
assert.equal(enrichedPilot.policyDerived, true)
assert.equal(enrichedPilot.configureHref, GROWTH_AI_OS_AUTONOMY_CONTROL_PLANE_PATH)
console.log("  ✓ Enrichment helpers attach policy to AI OS read models")

const dashboard = synthesizeAiOsOperationsDashboard(minimalCommandCenter, { automationApprovalCount: 0 }, policy)
assert.equal(dashboard.qaMarker, GROWTH_AI_OS_OPERATIONS_DASHBOARD_QA_MARKER)
assert.equal(dashboard.autonomyState.configureHref, GROWTH_AI_OS_AUTONOMY_CONTROL_PLANE_PATH)
assert.equal(dashboard.executiveOverview.configureHref, GROWTH_AI_OS_AUTONOMY_CONTROL_PLANE_PATH)
console.log("  ✓ Operations dashboard autonomy state synthesized from policy")

for (const file of [
  "lib/growth/autonomy/growth-ai-os-autonomy-policy-engine-service.ts",
  "lib/growth/aios/ai-os-command-center-service.ts",
]) {
  assertNoCoreTouch(file, ["public.invoices", "public.quotes", "blitz@equipify.com"])
}

const regressionScripts = [
  "test:ge-aios-consolidation-1b-information-architecture",
  "test:ge-aios-growth-5b-autonomous-research-agent",
  "test:ge-aios-growth-5a-scheduler-readiness",
  "test:ge-aios-growth-4f-priority-engine",
  "test:ge-aios-5c-command-center-read-model-foundation",
  "test:ge-aios-5d-daily-briefing-read-model-foundation",
]
for (const script of regressionScripts) {
  execSync(`pnpm ${script}`, { stdio: "inherit", cwd: process.cwd() })
}

console.log(`[${GROWTH_AIOS_CONSOLIDATION_1C_PHASE}] PASS — autonomy control plane certified (local)`)
