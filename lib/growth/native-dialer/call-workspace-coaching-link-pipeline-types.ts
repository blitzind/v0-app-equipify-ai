export const COACHING_LINK_PIPELINE_QA_MARKER = "coaching-link-pipeline-v1" as const

export type CoachingLinkPipelineStage =
  | "client_reconcile_inbound_answer"
  | "client_answer_api"
  | "server_calls_answer_route"
  | "server_answer_native_call_session"
  | "server_auto_start_coaching_on_answer"
  | "server_start_call_workspace_live_coaching"
  | "server_create_growth_realtime_call_session"
  | "server_link_native_call_realtime_session"
  | "server_pipeline_persisted_read"
  | "server_answer_response"

export type CoachingLinkPipelineStageOutcome = "entered" | "completed" | "failed" | "skipped"

export type CoachingLinkPipelineStageLogInput = {
  stage: CoachingLinkPipelineStage
  outcome: CoachingLinkPipelineStageOutcome
  durationMs?: number | null
  workspaceSessionId?: string | null
  nativeCallWorkspaceSessionId?: string | null
  nativeCallWorkspaceRealtimeSessionId?: string | null
  realtimeSessionId?: string | null
  voiceCallId?: string | null
  callSid?: string | null
  organizationId?: string | null
  ownerUserId?: string | null
  failureReason?: string | null
  liveCoachingLinked?: boolean | null
  linkResultLinked?: boolean | null
  linkResultReason?: string | null
  httpStatus?: number | null
  pipelineRunId?: string | null
  extra?: Record<string, unknown>
}

export function buildCoachingLinkPipelineRunId(input: {
  workspaceSessionId?: string | null
  voiceCallId?: string | null
}): string {
  const sessionPart = input.workspaceSessionId?.trim() || "no-session"
  const callPart = input.voiceCallId?.trim() || "no-call"
  return `${sessionPart}:${callPart}:${Date.now()}`
}

export type CoachingLinkPipelineTelemetryContext = {
  pipelineRunId?: string | null
  callSid?: string | null
}
