/**
 * GE-AIOS-CONSOLIDATION-1B — Growth OS information architecture certification.
 * Run: pnpm test:ge-aios-consolidation-1b-information-architecture
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  AI_OS_OPERATIONS_DASHBOARD_RUNTIME_RULE,
  GROWTH_AIOS_CONSOLIDATION_1B_PHASE,
  GROWTH_AI_OS_OPERATIONS_DASHBOARD_QA_MARKER,
} from "../lib/growth/aios/ai-os-operations-dashboard-types"
import { synthesizeAiOsOperationsDashboard } from "../lib/growth/aios/ai-os-operations-dashboard-synthesizer"
import { GROWTH_AI_OS_COMMAND_CENTER_QA_MARKER } from "../lib/growth/aios/ai-os-command-center-types"
import type { AiOsCommandCenterReadModel } from "../lib/growth/aios/ai-os-command-center-types"
import { GROWTH_AI_OS_DAILY_BRIEFING_QA_MARKER } from "../lib/growth/aios/ai-os-daily-briefing-types"
import { GROWTH_MISSION_PRIORITY_QA_MARKER } from "../lib/growth/aios/growth/growth-mission-priority-types"
import { GROWTH_AUTONOMOUS_RESEARCH_PILOT_QA_MARKER } from "../lib/growth/aios/growth/growth-autonomous-research-pilot-types"
import { buildDefaultGrowthAutonomySettings } from "../lib/growth/autonomy/growth-autonomy-config"
import { buildGrowthAiOsAutonomyPolicyReadModel } from "../lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string, forbidden: string[]): void {
  const source = readSource(relativePath)
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

console.log(`[${GROWTH_AIOS_CONSOLIDATION_1B_PHASE}] Information architecture certification`)

assert.equal(
  GROWTH_AI_OS_OPERATIONS_DASHBOARD_QA_MARKER,
  "growth-aios-consolidation-1b-operations-dashboard-v1",
)
assert.ok(AI_OS_OPERATIONS_DASHBOARD_RUNTIME_RULE.includes("read-only"))

const requiredFiles = [
  "lib/growth/aios/ai-os-operations-dashboard-types.ts",
  "lib/growth/aios/ai-os-operations-dashboard-synthesizer.ts",
  "components/growth/ai-os/operations/growth-ai-os-operations-dashboard.tsx",
  "components/growth/ai-os/operations/growth-ai-os-operations-section-card.tsx",
  "components/growth/ai-os/command-center/growth-ai-os-command-center-diagnostics-sections.tsx",
  "components/growth/ai-os/command-center/growth-ai-os-command-center-panel.tsx",
  "docs/GE-AIOS-CONSOLIDATION-1B_CERTIFICATION.md",
  "docs/GE-AIOS-CONSOLIDATION-1B_INFORMATION_ARCHITECTURE.md",
  "docs/GE-AIOS-CONSOLIDATION-1B_INFRASTRUCTURE_AUDIT.md",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
}

const types = readSource("lib/growth/aios/ai-os-command-center-types.ts")
assert.ok(types.includes("operationsDashboard: AiOsOperationsDashboardReadModel"))

const service = readSource("lib/growth/aios/ai-os-command-center-service.ts")
assert.ok(service.includes("synthesizeAiOsOperationsDashboard"))
assert.ok(service.includes("listGeV15OrganizationApprovalInbox"))
assert.equal(service.includes("transitionAiWorkOrder"), false)
assert.equal(service.includes("createAiWorkOrder"), false)
assert.equal(service.includes("runAiOsExecutMissionPlanningTick"), false)

const synthesizer = readSource("lib/growth/aios/ai-os-operations-dashboard-synthesizer.ts")
assert.ok(synthesizer.includes("buildExecutiveOverview"))
assert.ok(synthesizer.includes("buildActiveWork"))
assert.ok(synthesizer.includes("buildActivityTimeline"))
assert.ok(synthesizer.includes("buildHealthSummary"))
assert.ok(synthesizer.includes("buildApprovalSummary"))
assert.ok(synthesizer.includes("buildMissionPriorities"))
assert.ok(synthesizer.includes("buildActiveObjectives"))
assert.ok(synthesizer.includes("buildEngineeringDiagnostics"))
assert.equal(synthesizer.includes("TOP_PRIORITY_LIMIT = 10"), true)

const panel = readSource("components/growth/ai-os/command-center/growth-ai-os-command-center-panel.tsx")
assert.ok(panel.includes("GrowthAiOsOperationsDashboard"))
assert.ok(panel.includes("engineering-diagnostics-toggle"))
assert.ok(panel.includes("showEngineeringDiagnostics"))
assert.ok(panel.includes("GrowthAiOsCommandCenterDiagnosticsSections"))

const operationsUi = readSource("components/growth/ai-os/operations/growth-ai-os-operations-dashboard.tsx")
for (const qaSection of [
  "operations-executive-overview",
  "operations-active-work",
  "operations-ai-activity",
  "operations-ai-health",
  "operations-approval-summary",
  "operations-mission-priorities",
  "operations-active-objectives",
  "operations-autonomy-state",
  "operations-engineering-diagnostics-summary",
]) {
  assert.ok(operationsUi.includes(`qaSection="${qaSection}"`), `operations UI must include ${qaSection}`)
}

const diagnostics = readSource(
  "components/growth/ai-os/command-center/growth-ai-os-command-center-diagnostics-sections.tsx",
)
assert.ok(diagnostics.includes("GrowthAiOsGrowthLeadResearchWorkflowSection"))
assert.ok(diagnostics.includes("GrowthAiOsExecutionPlanReviewSection"))
assert.ok(diagnostics.includes("GrowthAiOsAgentFrameworkSection"))
assert.ok(diagnostics.includes("GrowthAiOsAutonomousResearchPilotSection"))

const navManifest = readSource("lib/growth/navigation/growth-workspace-shell-navigation.ts")
assert.ok(navManifest.includes('label: "AI Operations"'))
assert.ok(navManifest.includes('id: "ai-operations"'))

const page = readSource("app(growth)/growth/os/page.tsx")
assert.ok(page.includes('title="AI Operations"'))

const defaultAutonomySettings = buildDefaultGrowthAutonomySettings("org-test-1b")
const autonomyPolicy = buildGrowthAiOsAutonomyPolicyReadModel({
  organizationId: "org-test-1b",
  generatedAt: new Date().toISOString(),
  settings: {
    ...defaultAutonomySettings,
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

const minimalCommandCenter = {
  readOnly: true as const,
  qaMarker: GROWTH_AI_OS_COMMAND_CENTER_QA_MARKER,
  generatedAt: new Date().toISOString(),
  autonomyPolicy,
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
  agentHealth: { agents: [], generatedAt: new Date().toISOString() },
  providerHealth: { ready: true, providers: [], generatedAt: new Date().toISOString() },
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
    generatedAt: new Date().toISOString(),
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
    generatedAt: new Date().toISOString(),
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
    generatedAt: new Date().toISOString(),
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
    generatedAt: new Date().toISOString(),
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
    generatedAt: new Date().toISOString(),
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
    generatedAt: new Date().toISOString(),
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
    generatedAt: new Date().toISOString(),
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
    generatedAt: new Date().toISOString(),
    rule: "rule",
    summary: { leadsIndexed: 0, complete: 0, partial: 0, blocked: 0, conflictsDetected: 0 },
    leads: [],
  },
  missionFramework: {
    qaMarker: "growth-aios-growth-4e-mission-framework-v1",
    generatedAt: new Date().toISOString(),
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
    qaMarker: GROWTH_MISSION_PRIORITY_QA_MARKER,
    generatedAt: new Date().toISOString(),
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
    generatedAt: new Date().toISOString(),
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
    qaMarker: GROWTH_AUTONOMOUS_RESEARCH_PILOT_QA_MARKER,
    generatedAt: new Date().toISOString(),
    rule: "rule",
    agentKind: "research_agent" as const,
    schedulerMode: "controlled_agent_wake" as const,
    controlState: "disabled" as const,
    enabled: false,
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
    generatedAt: new Date().toISOString(),
    rule: "rule",
    agentKind: "qualification_agent" as const,
    schedulerMode: "controlled_agent_wake" as const,
    controlState: "disabled" as const,
    enabled: false,
    disabledAgentKinds: ["planning_agent", "execution_agent", "outreach_agent", "meeting_agent"],
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
  safeMode: {
    emergencyStopActive: false,
    objectiveModeEnabled: false,
    autonomyEnabled: true,
    killSwitches: {},
  },
  dailyBriefing: {
    readOnly: true,
    qaMarker: GROWTH_AI_OS_DAILY_BRIEFING_QA_MARKER,
    briefingId: "test",
    generatedAt: new Date().toISOString(),
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

const dashboard = synthesizeAiOsOperationsDashboard(minimalCommandCenter, { automationApprovalCount: 2 }, autonomyPolicy)
assert.equal(dashboard.readOnly, true)
assert.equal(dashboard.qaMarker, GROWTH_AI_OS_OPERATIONS_DASHBOARD_QA_MARKER)
assert.ok(dashboard.executiveOverview.operatingModeReadOnly)
assert.equal(dashboard.autonomyState.configureHref, "/growth/settings/autonomy")
assert.equal(dashboard.approvalSummary.categories.find((c) => c.id === "automation")?.count, 2)
assert.ok(dashboard.missionPriorities.length <= 10)

for (const file of [
  "lib/growth/aios/ai-os-operations-dashboard-synthesizer.ts",
  "lib/growth/aios/ai-os-command-center-service.ts",
  "components/growth/ai-os/command-center/growth-ai-os-command-center-panel.tsx",
]) {
  assertNoCoreTouch(file, ["public.invoices", "public.quotes", "blitz@equipify.com"])
}

const regressionScripts = [
  "test:ge-aios-growth-5b-autonomous-research-agent",
  "test:ge-aios-growth-5a-scheduler-readiness",
  "test:ge-aios-growth-4f-priority-engine",
  "test:ge-aios-5c-command-center-read-model-foundation",
  "test:ge-aios-5d-daily-briefing-read-model-foundation",
]
for (const script of regressionScripts) {
  execSync(`pnpm ${script}`, { stdio: "inherit", cwd: process.cwd() })
}

console.log(`[${GROWTH_AIOS_CONSOLIDATION_1B_PHASE}] PASS — information architecture certified (local)`)
