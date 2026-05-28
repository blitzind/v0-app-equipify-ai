/**
 * Workflow orchestration intelligence — Phase 5C regression checks.
 * Run: pnpm test:voice-workflow-orchestration-phase-5c
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  coordinateWorkflowAction,
  detectBlockedWorkflowDependencies,
  escalationProgressionLevel,
  mapActionToTransition,
} from "../lib/voice/workflow-orchestration/coordination-engine"
import { detectStalledWorkflows, buildWorkflowHealthSummary } from "../lib/voice/workflow-orchestration/health-monitor"
import {
  mapOrchestrationTypeToChannel,
  summarizeMultiChannelJourney,
} from "../lib/voice/workflow-orchestration/multi-channel-coordination"
import { generateWorkflowRecommendation } from "../lib/voice/workflow-orchestration/recommendations"
import { buildOrchestrationReplay } from "../lib/voice/workflow-orchestration/replay-generator"
import { buildRoutingRecommendations } from "../lib/voice/workflow-orchestration/routing-visibility"
import {
  buildWorkflowCommandSummary,
  buildWorkflowWorkspaceSnapshot,
} from "../lib/voice/workflow-orchestration/snapshot-builder"
import {
  defaultPriorityForType,
  isTerminalWorkflowStatus,
  transitionWorkflowStatus,
} from "../lib/voice/workflow-orchestration/state-machine"
import {
  VOICE_WORKFLOW_AUTONOMOUS_EXECUTION_DISABLED,
  VOICE_WORKFLOW_AUTO_CRM_MUTATION_DISABLED,
  VOICE_WORKFLOW_AUTO_OPERATOR_REASSIGNMENT_DISABLED,
  VOICE_WORKFLOW_MAX_ACTIVE_ORCHESTRATIONS,
  VOICE_WORKFLOW_MAX_TIMELINE_EVENTS,
  VOICE_WORKFLOW_ORCHESTRATION_QA_MARKER,
  VOICE_WORKFLOW_RETENTION_DAYS,
  VOICE_WORKFLOW_STALE_HOURS,
} from "../lib/voice/workflow-orchestration/types"
import { VOICE_SCHEMA_MIGRATION_ID, VOICE_SCHEMA_PROBE_VERSION } from "../lib/voice/schema-health"

assert.equal(VOICE_WORKFLOW_ORCHESTRATION_QA_MARKER, "voice-workflow-orchestration-v1")
assert.equal(VOICE_SCHEMA_PROBE_VERSION, "v19")
assert.equal(VOICE_SCHEMA_MIGRATION_ID, "20270619120000_voice_workflow_orchestration_phase_5c")
assert.equal(VOICE_WORKFLOW_AUTONOMOUS_EXECUTION_DISABLED, true)
assert.equal(VOICE_WORKFLOW_AUTO_CRM_MUTATION_DISABLED, true)
assert.equal(VOICE_WORKFLOW_AUTO_OPERATOR_REASSIGNMENT_DISABLED, true)
assert.equal(VOICE_WORKFLOW_STALE_HOURS, 48)
assert.equal(VOICE_WORKFLOW_RETENTION_DAYS, 90)
assert.equal(VOICE_WORKFLOW_MAX_TIMELINE_EVENTS, 50)
assert.equal(VOICE_WORKFLOW_MAX_ACTIVE_ORCHESTRATIONS, 200)

// State machine transitions
const activate = transitionWorkflowStatus({ currentStatus: "pending", action: "activate" })
assert.equal(activate.allowed, true)
assert.equal(activate.status, "active")

const escalate = transitionWorkflowStatus({ currentStatus: "active", action: "escalate" })
assert.equal(escalate.status, "escalated")
assert.equal(escalate.escalationLevelDelta, 1)

const terminal = transitionWorkflowStatus({ currentStatus: "completed", action: "escalate" })
assert.equal(terminal.allowed, false)

assert.equal(isTerminalWorkflowStatus("completed"), true)
assert.equal(isTerminalWorkflowStatus("active"), false)

assert.equal(defaultPriorityForType("escalation_recovery"), 90)
assert.equal(defaultPriorityForType("callback_followup"), 75)

// Coordination engine
const mockOrchestration = {
  id: "00000000-0000-4000-8000-000000000001",
  organizationId: "00000000-0000-4000-8000-000000000002",
  orchestrationType: "callback_followup" as const,
  orchestrationStatus: "awaiting_operator" as const,
  priority: 75,
  sourceSessionId: null,
  sourceCallId: null,
  sourceCampaignId: null,
  relationshipMemoryProfileId: null,
  relatedCustomerId: null,
  relatedProspectId: null,
  relatedOpportunityId: null,
  assignedOperatorId: null,
  escalationLevel: 0,
  complianceState: null,
  nextRecommendedAction: null,
  blockedReason: null,
  orchestrationSummary: "Test",
  metadata: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  resolvedAt: null,
}

const assignResult = coordinateWorkflowAction({
  orchestration: mockOrchestration,
  action: "assign_operator",
  operatorId: "op-1",
})
assert.equal(assignResult.allowed, true)
assert.equal(assignResult.eventType, "workflow_assigned")
assert.ok(assignResult.nextRecommendedAction)

const escalateResult = coordinateWorkflowAction({
  orchestration: { ...mockOrchestration, orchestrationStatus: "active", assignedOperatorId: "op-1" },
  action: "escalate",
})
assert.equal(escalateResult.nextStatus, "escalated")

assert.equal(mapActionToTransition("resolve"), "resolve")
assert.equal(escalationProgressionLevel(2, 1), 3)
assert.equal(escalationProgressionLevel(5, 1), 5)

const deps = detectBlockedWorkflowDependencies([
  { ...mockOrchestration, id: "a", orchestrationStatus: "compliance_hold", relatedCustomerId: "cust-1" },
  { ...mockOrchestration, id: "b", orchestrationStatus: "blocked", relatedCustomerId: "cust-1" },
])
assert.equal(deps.length, 1)
assert.equal(deps[0]?.blockedBy, "a")

// Recommendations
const complianceRec = generateWorkflowRecommendation({
  orchestrationType: "callback_followup",
  orchestrationStatus: "compliance_hold",
  escalationLevel: 0,
  blockedReason: "DNC review",
  complianceState: "hold",
})
assert.ok(complianceRec.action.includes("compliance"))
assert.equal(complianceRec.autonomousExecutionDisabled, true)
assert.equal(complianceRec.requiresOperatorReview, true)

// Routing visibility
const routing = buildRoutingRecommendations({
  orchestrationType: "escalation_recovery",
  escalationLevel: 2,
  complianceSensitive: true,
  afterHours: false,
  operatorCandidates: [
    { operatorId: "op-1", label: "Alice", activeWorkflowCount: 1, isAvailable: true },
    { operatorId: "op-2", label: "Bob", activeWorkflowCount: 4, isAvailable: true },
  ],
  relationshipOwnerId: "op-1",
})
assert.ok(routing.length > 0)
assert.ok(routing.every((r) => r.autoAssignmentDisabled === true))
assert.ok(routing.some((r) => r.operatorId === "op-1"))

// Health monitoring
const staleDate = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
const stalled = detectStalledWorkflows([
  { ...mockOrchestration, orchestrationStatus: "active", updatedAt: staleDate },
  { ...mockOrchestration, orchestrationStatus: "active", updatedAt: new Date().toISOString() },
])
assert.equal(stalled.length, 1)

const health = buildWorkflowHealthSummary([
  { ...mockOrchestration, orchestrationStatus: "escalated", escalationLevel: 1 },
  { ...mockOrchestration, orchestrationStatus: "compliance_hold" },
  { ...mockOrchestration, orchestrationStatus: "active", updatedAt: staleDate },
])
assert.ok(health.stalledCount >= 1)
assert.ok(health.unresolvedEscalationCount >= 1)
assert.ok(health.complianceHoldCount >= 1)

// Multi-channel coordination
const journey = summarizeMultiChannelJourney(
  [
    { fromChannel: null, toChannel: "voice", success: true, evidence: "Inbound call", timestamp: new Date().toISOString() },
    { fromChannel: "voice", toChannel: "callback", success: false, evidence: "Callback missed", timestamp: new Date().toISOString() },
  ],
  3,
  false,
)
assert.equal(journey.unresolved, true)
assert.equal(journey.failedTransitions, 1)
assert.equal(mapOrchestrationTypeToChannel("ai_receptionist_handoff"), "ai_receptionist")

// Replay generation
const replay = buildOrchestrationReplay(mockOrchestration, [
  {
    id: "e1",
    organizationId: mockOrchestration.organizationId,
    orchestrationId: mockOrchestration.id,
    eventType: "workflow_created",
    sourceSystem: "workflow_orchestration",
    evidenceText: "Created",
    linkedSessionId: null,
    linkedCallId: null,
    payload: {},
    createdBy: null,
    createdAt: new Date(Date.now() - 1000).toISOString(),
  },
  {
    id: "e2",
    organizationId: mockOrchestration.organizationId,
    orchestrationId: mockOrchestration.id,
    eventType: "workflow_assigned",
    sourceSystem: "workflow_orchestration",
    evidenceText: "Assigned",
    linkedSessionId: null,
    linkedCallId: null,
    payload: {},
    createdBy: null,
    createdAt: new Date().toISOString(),
  },
])
assert.equal(replay.eventCount, 2)
assert.equal(replay.timeline[0]?.eventType, "workflow_created")

// Snapshots
const workspace = buildWorkflowWorkspaceSnapshot({
  activeOrchestrations: [mockOrchestration],
  stalledOrchestrations: stalled,
  recentEvents: [],
  health,
  routingRecommendations: routing,
})
assert.equal(workspace.qaMarker, "voice-workflow-orchestration-v1")
assert.equal(workspace.autonomousExecutionDisabled, true)

const commandSummary = buildWorkflowCommandSummary({
  activeOrchestrations: [mockOrchestration],
  health,
})
assert.ok(commandSummary.activeCount >= 1)
assert.ok(commandSummary.message.includes("visibility"))

// Migration + API + UI wiring
const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20270619120000_voice_workflow_orchestration_phase_5c.sql",
)
assert.ok(fs.existsSync(migrationPath))
assert.ok(fs.readFileSync(migrationPath, "utf8").includes("voice_workflow_orchestrations"))

const apiRoutes = [
  "app/api/platform/growth/voice/workflow-orchestration/readiness/route.ts",
  "app/api/platform/growth/voice/workflow-orchestration/workspace/route.ts",
  "app/api/platform/growth/voice/workflow-orchestration/command-summary/route.ts",
  "app/api/platform/growth/voice/workflow-orchestration/orchestrations/route.ts",
  "app/api/platform/growth/voice/workflow-orchestration/orchestrations/[orchestrationId]/route.ts",
]
for (const route of apiRoutes) {
  assert.ok(fs.existsSync(path.join(process.cwd(), route)), `Missing route: ${route}`)
}

const uiComponents = [
  "components/growth/growth-workflow-orchestration-workspace.tsx",
  "components/growth/growth-workflow-orchestration-readiness-section.tsx",
  "components/growth/growth-command-workflow-orchestration-section.tsx",
]
for (const component of uiComponents) {
  const content = fs.readFileSync(path.join(process.cwd(), component), "utf8")
  assert.ok(content.includes("data-voice-workflow-orchestration-qa-marker"))
}

const settingsPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-voice-infrastructure-settings-panel.tsx"),
  "utf8",
)
assert.ok(settingsPanel.includes("GrowthWorkflowOrchestrationReadinessSection"))
assert.ok(settingsPanel.includes("GrowthWorkflowOrchestrationWorkspace"))

const commandCenter = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-command-center-dashboard.tsx"),
  "utf8",
)
assert.ok(commandCenter.includes("GrowthCommandWorkflowOrchestrationSection"))

console.log("voice-workflow-orchestration-phase-5c: all checks passed")
