/** Workflow orchestration snapshot builders — Phase 5C. */

import type {
  VoiceWorkflowOrchestrationCommandSummary,
  VoiceWorkflowOrchestrationWorkspaceSnapshot,
  VoiceWorkflowHealthSummary,
  VoiceWorkflowOrchestrationEventPublicView,
  VoiceWorkflowOrchestrationPublicView,
  VoiceWorkflowRoutingRecommendation,
} from "@/lib/voice/workflow-orchestration/types"
import { VOICE_WORKFLOW_ORCHESTRATION_QA_MARKER } from "@/lib/voice/workflow-orchestration/types"

export function buildWorkflowWorkspaceSnapshot(input: {
  activeOrchestrations: VoiceWorkflowOrchestrationPublicView[]
  stalledOrchestrations: VoiceWorkflowOrchestrationPublicView[]
  recentEvents: VoiceWorkflowOrchestrationEventPublicView[]
  health: VoiceWorkflowHealthSummary
  routingRecommendations: VoiceWorkflowRoutingRecommendation[]
}): VoiceWorkflowOrchestrationWorkspaceSnapshot {
  return {
    qaMarker: VOICE_WORKFLOW_ORCHESTRATION_QA_MARKER,
    generatedAt: new Date().toISOString(),
    activeOrchestrations: input.activeOrchestrations,
    stalledOrchestrations: input.stalledOrchestrations,
    recentEvents: input.recentEvents,
    health: input.health,
    routingRecommendations: input.routingRecommendations,
    autonomousExecutionDisabled: true,
    message: "Workflow orchestration workspace — operator-controlled coordination only.",
  }
}

export function buildWorkflowCommandSummary(input: {
  activeOrchestrations: VoiceWorkflowOrchestrationPublicView[]
  health: VoiceWorkflowHealthSummary
}): VoiceWorkflowOrchestrationCommandSummary {
  const active = input.activeOrchestrations
  const assignedOperators = new Set(active.map((o) => o.assignedOperatorId).filter(Boolean))

  return {
    qaMarker: VOICE_WORKFLOW_ORCHESTRATION_QA_MARKER,
    activeCount: active.length,
    stalledCount: input.health.stalledCount,
    escalatedCount: active.filter((o) => o.orchestrationStatus === "escalated").length,
    complianceHoldCount: input.health.complianceHoldCount,
    awaitingOperatorCount: active.filter((o) => o.orchestrationStatus === "awaiting_operator").length,
    unresolvedTrendCount: input.health.unresolvedObjectionCount + input.health.overdueFollowUpCount,
    operatorWorkloadEstimate: assignedOperators.size,
    message: "Workflow orchestration metrics — visibility only, no autonomous balancing.",
  }
}
