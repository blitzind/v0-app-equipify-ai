import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { recordVoiceObservabilityEvent } from "@/lib/voice/observability/observability-service"
import { isVoiceObservabilityEnabled } from "@/lib/voice/observability/observability-service"
import {
  appendWorkflowOrchestrationEvent,
  createWorkflowOrchestration,
  expireStaleWorkflowOrchestrations,
  getWorkflowOrchestration,
  listActiveWorkflowOrchestrations,
  listWorkflowOrchestrationEvents,
  listRecentWorkflowOrchestrationEvents,
  updateWorkflowOrchestration,
} from "@/lib/voice/repository/voice-workflow-orchestration-repository"
import { probeVoiceSchemaHealth } from "@/lib/voice/schema-health"
import {
  coordinateWorkflowAction,
  escalationProgressionLevel,
} from "@/lib/voice/workflow-orchestration/coordination-engine"
import { detectStalledWorkflows, buildWorkflowHealthSummary } from "@/lib/voice/workflow-orchestration/health-monitor"
import { buildOrchestrationReplay } from "@/lib/voice/workflow-orchestration/replay-generator"
import { generateWorkflowRecommendation } from "@/lib/voice/workflow-orchestration/recommendations"
import { buildRoutingRecommendations } from "@/lib/voice/workflow-orchestration/routing-visibility"
import {
  buildWorkflowCommandSummary,
  buildWorkflowWorkspaceSnapshot,
} from "@/lib/voice/workflow-orchestration/snapshot-builder"
import {
  defaultPriorityForType,
  defaultSummaryForType,
} from "@/lib/voice/workflow-orchestration/state-machine"
import type {
  VoiceWorkflowOrchestrationCommandSummary,
  VoiceWorkflowOrchestrationReadinessSnapshot,
  VoiceWorkflowOrchestrationType,
  VoiceWorkflowOrchestrationWorkspaceSnapshot,
  WorkflowOrchestrationAction,
} from "@/lib/voice/workflow-orchestration/types"
import {
  VOICE_WORKFLOW_MAX_ACTIVE_ORCHESTRATIONS,
  VOICE_WORKFLOW_MAX_TIMELINE_EVENTS,
  VOICE_WORKFLOW_ORCHESTRATION_QA_MARKER,
  VOICE_WORKFLOW_RETENTION_DAYS,
  VOICE_WORKFLOW_SNAPSHOT_CACHE_MINUTES,
  VOICE_WORKFLOW_STALE_HOURS,
} from "@/lib/voice/workflow-orchestration/types"

type SnapshotCacheEntry = {
  expiresAt: number
  workspace: VoiceWorkflowOrchestrationWorkspaceSnapshot
}

const workspaceCache = new Map<string, SnapshotCacheEntry>()

export function isVoiceWorkflowOrchestrationEnabled(): boolean {
  return process.env.VOICE_WORKFLOW_ORCHESTRATION_ENABLED === "true"
}

function workflowRetentionCutoffIso(): string {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - VOICE_WORKFLOW_RETENTION_DAYS)
  return cutoff.toISOString()
}

function staleWorkflowCutoffIso(): string {
  const cutoff = new Date()
  cutoff.setHours(cutoff.getHours() - VOICE_WORKFLOW_STALE_HOURS)
  return cutoff.toISOString()
}

async function recordWorkflowObservability(
  admin: SupabaseClient,
  input: {
    organizationId: string
    eventType: string
    severity?: "info" | "warning" | "critical"
    sourceSessionId?: string | null
    sourceCallId?: string | null
    sourceCampaignId?: string | null
    relationshipMemoryProfileId?: string | null
    relatedCustomerId?: string | null
    relatedProspectId?: string | null
    evidence?: Record<string, unknown>
  },
) {
  if (!isVoiceObservabilityEnabled()) return null
  return recordVoiceObservabilityEvent(admin, {
    organizationId: input.organizationId,
    eventCategory: input.eventType.includes("escalation") ? "escalation" : "ai_orchestration",
    eventType: input.eventType,
    severity: input.severity ?? "info",
    sourceSystem: "workflow_orchestration",
    sourceSessionId: input.sourceSessionId,
    sourceCallId: input.sourceCallId,
    sourceCampaignId: input.sourceCampaignId,
    relationshipMemoryProfileId: input.relationshipMemoryProfileId,
    relatedCustomerId: input.relatedCustomerId,
    relatedProspectId: input.relatedProspectId,
    evidence: input.evidence,
    metadata: { phase: "5c", autonomousExecutionDisabled: true },
  })
}

export async function fetchWorkflowOrchestrationReadiness(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceWorkflowOrchestrationReadinessSnapshot> {
  const schema = await probeVoiceSchemaHealth(admin)
  const enabled = isVoiceWorkflowOrchestrationEnabled()
  const observabilityReady = isVoiceObservabilityEnabled()

  return {
    qaMarker: VOICE_WORKFLOW_ORCHESTRATION_QA_MARKER,
    schemaReady: schema.ready,
    orchestrationEnabled: enabled,
    escalationCoordinationReady: schema.ready && enabled,
    routingVisibilityReady: schema.ready,
    workflowAnalyticsReady: schema.ready && enabled,
    stalledWorkflowDetectionReady: schema.ready,
    multiChannelCoordinationReady: schema.ready,
    observabilityIntegrationReady: observabilityReady && schema.ready,
    autonomousWorkflowExecutionDisabled: true,
    message: enabled
      ? "Workflow orchestration enabled — operator-controlled coordination only."
      : "Set VOICE_WORKFLOW_ORCHESTRATION_ENABLED=true to activate workflow orchestration intelligence.",
  }
}

async function loadActiveOrchestrations(admin: SupabaseClient, organizationId: string) {
  await cleanupStaleWorkflowOrchestrations(admin, organizationId)
  return listActiveWorkflowOrchestrations(admin, organizationId, VOICE_WORKFLOW_MAX_ACTIVE_ORCHESTRATIONS)
}

export async function fetchWorkflowOrchestrationWorkspace(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceWorkflowOrchestrationWorkspaceSnapshot> {
  const cacheKey = organizationId
  const cached = workspaceCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.workspace
  }

  const activeOrchestrations = await loadActiveOrchestrations(admin, organizationId)
  const stalledOrchestrations = detectStalledWorkflows(activeOrchestrations)
  const recentEvents = await listRecentWorkflowOrchestrationEvents(admin, organizationId, 30)
  const health = buildWorkflowHealthSummary(activeOrchestrations)

  const routingRecommendations = buildRoutingRecommendations({
    orchestrationType: activeOrchestrations[0]?.orchestrationType ?? "callback_followup",
    escalationLevel: Math.max(0, ...activeOrchestrations.map((o) => o.escalationLevel)),
    complianceSensitive: health.complianceHoldCount > 0,
    afterHours: new Date().getHours() < 8 || new Date().getHours() >= 18,
    operatorCandidates: [],
    relationshipOwnerId: activeOrchestrations[0]?.assignedOperatorId,
  })

  const workspace = buildWorkflowWorkspaceSnapshot({
    activeOrchestrations,
    stalledOrchestrations,
    recentEvents: recentEvents.slice(0, VOICE_WORKFLOW_MAX_TIMELINE_EVENTS),
    health,
    routingRecommendations,
  })

  workspaceCache.set(cacheKey, {
    expiresAt: Date.now() + VOICE_WORKFLOW_SNAPSHOT_CACHE_MINUTES * 60 * 1000,
    workspace,
  })

  return workspace
}

export async function fetchWorkflowOrchestrationCommandSummary(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceWorkflowOrchestrationCommandSummary> {
  const activeOrchestrations = await loadActiveOrchestrations(admin, organizationId)
  const health = buildWorkflowHealthSummary(activeOrchestrations)
  return buildWorkflowCommandSummary({ activeOrchestrations, health })
}

export async function createWorkflowOrchestrationRecord(
  admin: SupabaseClient,
  input: {
    organizationId: string
    orchestrationType: VoiceWorkflowOrchestrationType
    userId?: string | null
    sourceSessionId?: string | null
    sourceCallId?: string | null
    sourceCampaignId?: string | null
    relationshipMemoryProfileId?: string | null
    relatedCustomerId?: string | null
    relatedProspectId?: string | null
    relatedOpportunityId?: string | null
    orchestrationSummary?: string
    metadata?: Record<string, unknown>
  },
) {
  if (!isVoiceWorkflowOrchestrationEnabled()) {
    throw new Error("Workflow orchestration is disabled.")
  }

  const recommendation = generateWorkflowRecommendation({
    orchestrationType: input.orchestrationType,
    orchestrationStatus: "pending",
    escalationLevel: 0,
    blockedReason: null,
    complianceState: null,
  })

  const orchestration = await createWorkflowOrchestration(admin, {
    organizationId: input.organizationId,
    orchestrationType: input.orchestrationType,
    priority: defaultPriorityForType(input.orchestrationType),
    sourceSessionId: input.sourceSessionId,
    sourceCallId: input.sourceCallId,
    sourceCampaignId: input.sourceCampaignId,
    relationshipMemoryProfileId: input.relationshipMemoryProfileId,
    relatedCustomerId: input.relatedCustomerId,
    relatedProspectId: input.relatedProspectId,
    relatedOpportunityId: input.relatedOpportunityId,
    orchestrationSummary: input.orchestrationSummary ?? defaultSummaryForType(input.orchestrationType),
    nextRecommendedAction: recommendation.action,
    metadata: input.metadata,
  })

  await appendWorkflowOrchestrationEvent(admin, {
    organizationId: input.organizationId,
    orchestrationId: orchestration.id,
    eventType: "workflow_created",
    evidenceText: `Workflow created: ${input.orchestrationType}.`,
    linkedSessionId: input.sourceSessionId,
    linkedCallId: input.sourceCallId,
    createdBy: input.userId,
    payload: { autonomousExecutionDisabled: true },
  })

  await recordWorkflowObservability(admin, {
    organizationId: input.organizationId,
    eventType: "workflow_orchestration_created",
    sourceSessionId: input.sourceSessionId,
    sourceCallId: input.sourceCallId,
    sourceCampaignId: input.sourceCampaignId,
    relationshipMemoryProfileId: input.relationshipMemoryProfileId,
    relatedCustomerId: input.relatedCustomerId,
    relatedProspectId: input.relatedProspectId,
    evidence: { orchestrationType: input.orchestrationType, orchestrationId: orchestration.id },
  })

  workspaceCache.delete(input.organizationId)
  return orchestration
}

export async function fetchWorkflowOrchestrationDetail(
  admin: SupabaseClient,
  organizationId: string,
  orchestrationId: string,
) {
  const orchestration = await getWorkflowOrchestration(admin, organizationId, orchestrationId)
  if (!orchestration) return null

  const events = await listWorkflowOrchestrationEvents(
    admin,
    organizationId,
    orchestrationId,
    VOICE_WORKFLOW_MAX_TIMELINE_EVENTS,
  )
  const replay = buildOrchestrationReplay(orchestration, events)
  const recommendation = generateWorkflowRecommendation(orchestration)
  const routingRecommendations = buildRoutingRecommendations({
    orchestrationType: orchestration.orchestrationType,
    escalationLevel: orchestration.escalationLevel,
    complianceSensitive: Boolean(orchestration.complianceState),
    afterHours: new Date().getHours() < 8 || new Date().getHours() >= 18,
    operatorCandidates: [],
    relationshipOwnerId: orchestration.assignedOperatorId,
  })

  return { orchestration, events, replay, recommendation, routingRecommendations }
}

export async function applyWorkflowOrchestrationAction(
  admin: SupabaseClient,
  input: {
    organizationId: string
    orchestrationId: string
    action: WorkflowOrchestrationAction
    userId?: string | null
    operatorId?: string | null
    blockedReason?: string | null
    complianceState?: string | null
  },
) {
  if (!isVoiceWorkflowOrchestrationEnabled()) {
    throw new Error("Workflow orchestration is disabled.")
  }

  const orchestration = await getWorkflowOrchestration(admin, input.organizationId, input.orchestrationId)
  if (!orchestration) throw new Error("Orchestration not found.")

  const coordination = coordinateWorkflowAction({
    orchestration,
    action: input.action,
    operatorId: input.operatorId,
    blockedReason: input.blockedReason,
    complianceState: input.complianceState,
  })

  if (!coordination.allowed) {
    throw new Error(coordination.reason ?? "Action not allowed.")
  }

  const resolvedAt =
    coordination.nextStatus === "completed" ||
    coordination.nextStatus === "canceled" ||
    coordination.nextStatus === "expired"
      ? new Date().toISOString()
      : null

  const updated = await updateWorkflowOrchestration(admin, {
    organizationId: input.organizationId,
    orchestrationId: input.orchestrationId,
    patch: {
      orchestrationStatus: coordination.nextStatus,
      assignedOperatorId:
        input.action === "assign_operator" ? (input.operatorId ?? input.userId ?? null) : orchestration.assignedOperatorId,
      escalationLevel: escalationProgressionLevel(
        orchestration.escalationLevel,
        coordination.escalationLevelDelta,
      ),
      complianceState: input.complianceState ?? orchestration.complianceState,
      nextRecommendedAction: coordination.nextRecommendedAction,
      blockedReason: coordination.blockedReason,
      resolvedAt,
    },
  })

  if (!updated) throw new Error("Failed to update orchestration.")

  await appendWorkflowOrchestrationEvent(admin, {
    organizationId: input.organizationId,
    orchestrationId: input.orchestrationId,
    eventType: coordination.eventType,
    evidenceText: coordination.evidenceText,
    linkedSessionId: orchestration.sourceSessionId,
    linkedCallId: orchestration.sourceCallId,
    createdBy: input.userId,
    payload: { action: input.action, autonomousExecutionDisabled: true },
  })

  if (coordination.eventType === "escalation_triggered") {
    await recordWorkflowObservability(admin, {
      organizationId: input.organizationId,
      eventType: "workflow_escalation_triggered",
      severity: "warning",
      sourceSessionId: orchestration.sourceSessionId,
      sourceCallId: orchestration.sourceCallId,
      evidence: { orchestrationId: orchestration.id, escalationLevel: updated.escalationLevel },
    })
  }

  if (coordination.eventType === "workflow_resolved") {
    await recordWorkflowObservability(admin, {
      organizationId: input.organizationId,
      eventType: "workflow_orchestration_resolved",
      sourceSessionId: orchestration.sourceSessionId,
      sourceCallId: orchestration.sourceCallId,
      evidence: { orchestrationId: orchestration.id, status: coordination.nextStatus },
    })
  }

  workspaceCache.delete(input.organizationId)
  return updated
}

export async function cleanupStaleWorkflowOrchestrations(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number> {
  const staleBeforeIso = staleWorkflowCutoffIso()
  const expiredCount = await expireStaleWorkflowOrchestrations(admin, organizationId, staleBeforeIso)

  if (expiredCount > 0) {
    await recordWorkflowObservability(admin, {
      organizationId,
      eventType: "stalled_workflows_expired",
      severity: "warning",
      evidence: { expiredCount, staleHours: VOICE_WORKFLOW_STALE_HOURS },
    })
  }

  return expiredCount
}

export async function detectAndRecordStalledWorkflows(
  admin: SupabaseClient,
  organizationId: string,
) {
  const active = await listActiveWorkflowOrchestrations(admin, organizationId, VOICE_WORKFLOW_MAX_ACTIVE_ORCHESTRATIONS)
  const stalled = detectStalledWorkflows(active)

  for (const o of stalled.slice(0, 10)) {
    await appendWorkflowOrchestrationEvent(admin, {
      organizationId,
      orchestrationId: o.id,
      eventType: "stalled_detected",
      evidenceText: `Workflow stalled — no update in ${VOICE_WORKFLOW_STALE_HOURS}h.`,
      linkedSessionId: o.sourceSessionId,
      linkedCallId: o.sourceCallId,
      payload: { autonomousExecutionDisabled: true },
    })
  }

  if (stalled.length > 0) {
    await recordWorkflowObservability(admin, {
      organizationId,
      eventType: "stalled_workflows_detected",
      severity: "warning",
      evidence: { stalledCount: stalled.length },
    })
  }

  return stalled
}

export function workflowRetentionCutoffIsoForTests(): string {
  return workflowRetentionCutoffIso()
}
