/** Orchestration replay generation — Phase 5C. */

import type {
  VoiceWorkflowOrchestrationEventPublicView,
  VoiceWorkflowOrchestrationPublicView,
} from "@/lib/voice/workflow-orchestration/types"

export type WorkflowOrchestrationReplay = {
  orchestrationId: string
  orchestrationType: string
  currentStatus: string
  eventCount: number
  timeline: Array<{
    eventType: string
    evidenceText: string
    sourceSystem: string
    createdAt: string
  }>
  summary: string
}

export function buildOrchestrationReplay(
  orchestration: VoiceWorkflowOrchestrationPublicView,
  events: VoiceWorkflowOrchestrationEventPublicView[],
): WorkflowOrchestrationReplay {
  const sorted = [...events].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )

  return {
    orchestrationId: orchestration.id,
    orchestrationType: orchestration.orchestrationType,
    currentStatus: orchestration.orchestrationStatus,
    eventCount: sorted.length,
    timeline: sorted.map((e) => ({
      eventType: e.eventType,
      evidenceText: e.evidenceText,
      sourceSystem: e.sourceSystem,
      createdAt: e.createdAt,
    })),
    summary: orchestration.orchestrationSummary,
  }
}
