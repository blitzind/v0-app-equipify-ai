import type { CoachingLinkPipelineStageOutcome } from "@/lib/growth/native-dialer/call-workspace-coaching-link-pipeline-types"

export const CALL_WORKSPACE_COACHING_UI_QA_MARKER = "call-workspace-coaching-ui-v1" as const

export type CallWorkspaceCoachingRenderState =
  | "diagnostic_banner"
  | "coaching_active"
  | "coaching_pending_answer_reconcile"
  | "coaching_start_available"
  | "coaching_idle"

export type CallWorkspaceCoachingUiTelemetryInput = {
  event:
    | "voice_call_workspace_coaching_render_decision"
    | "voice_call_workspace_coaching_answer_timing"
    | "voice_call_workspace_coaching_sync_merge"
  workspaceSessionId?: string | null
  realtimeSessionId?: string | null
  linkedRealtimeSessionId?: string | null
  operatorAssistRealtimeSessionId?: string | null
  liveCoachingLinked?: boolean | null
  answerPipelineDiagnostic?: string | null
  coachingStatus?: string | null
  renderedCoachingState?: CallWorkspaceCoachingRenderState | null
  syncMode?: "fast" | "enrichment" | null
  phase?: string | null
  answerReconciliationPending?: boolean | null
  coachingActive?: boolean | null
  hasLinkedRealtimeSession?: boolean | null
  durationMs?: number | null
  stage?: string | null
  outcome?: CoachingLinkPipelineStageOutcome | null
  failureReason?: string | null
  extra?: Record<string, unknown>
}

export function logCallWorkspaceCoachingUiTelemetry(input: CallWorkspaceCoachingUiTelemetryInput): void {
  console.info(
    JSON.stringify({
      source: "growth-call-workspace",
      qaMarker: CALL_WORKSPACE_COACHING_UI_QA_MARKER,
      ts: new Date().toISOString(),
      ...input,
    }),
  )
}
