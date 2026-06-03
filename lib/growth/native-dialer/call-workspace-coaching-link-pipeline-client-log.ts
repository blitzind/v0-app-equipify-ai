import {
  buildCoachingLinkPipelineRunId,
  COACHING_LINK_PIPELINE_QA_MARKER,
  type CoachingLinkPipelineStage,
  type CoachingLinkPipelineStageLogInput,
  type CoachingLinkPipelineStageOutcome,
} from "@/lib/growth/native-dialer/call-workspace-coaching-link-pipeline-types"

export { buildCoachingLinkPipelineRunId, COACHING_LINK_PIPELINE_QA_MARKER }

export function logCoachingLinkPipelineStageClient(input: CoachingLinkPipelineStageLogInput): void {
  console.info(
    JSON.stringify({
      source: "growth-call-workspace",
      event: "voice_growth_coaching_link_pipeline_stage",
      qaMarker: COACHING_LINK_PIPELINE_QA_MARKER,
      ts: new Date().toISOString(),
      stage: input.stage,
      outcome: input.outcome,
      durationMs: input.durationMs ?? null,
      pipelineRunId: input.pipelineRunId ?? null,
      workspaceSessionId: input.workspaceSessionId ?? null,
      nativeCallWorkspaceSessionId: input.nativeCallWorkspaceSessionId ?? null,
      nativeCallWorkspaceRealtimeSessionId: input.nativeCallWorkspaceRealtimeSessionId ?? null,
      realtimeSessionId: input.realtimeSessionId ?? null,
      voiceCallId: input.voiceCallId ?? null,
      callSid: input.callSid ?? null,
      organizationId: input.organizationId ?? null,
      ownerUserId: input.ownerUserId ?? null,
      failureReason: input.failureReason ?? null,
      liveCoachingLinked: input.liveCoachingLinked ?? null,
      linkResultLinked: input.linkResultLinked ?? null,
      linkResultReason: input.linkResultReason ?? null,
      httpStatus: input.httpStatus ?? null,
      ...(input.extra ?? {}),
    }),
  )
}

export type CoachingLinkPipelineClientContext = {
  pipelineRunId: string
  workspaceSessionId: string | null
  voiceCallId: string | null
  callSid: string | null
}

export function createCoachingLinkPipelineClientContext(input: {
  workspaceSessionId?: string | null
  voiceCallId?: string | null
  callSid?: string | null
}): CoachingLinkPipelineClientContext {
  return {
    pipelineRunId: buildCoachingLinkPipelineRunId({
      workspaceSessionId: input.workspaceSessionId,
      voiceCallId: input.voiceCallId,
    }),
    workspaceSessionId: input.workspaceSessionId ?? null,
    voiceCallId: input.voiceCallId ?? null,
    callSid: input.callSid ?? null,
  }
}

export function logClientCoachingLinkStage(
  ctx: CoachingLinkPipelineClientContext,
  stage: CoachingLinkPipelineStage,
  outcome: CoachingLinkPipelineStageOutcome,
  fields?: Partial<Omit<CoachingLinkPipelineStageLogInput, "stage" | "outcome" | "pipelineRunId">>,
): void {
  logCoachingLinkPipelineStageClient({
    stage,
    outcome,
    pipelineRunId: ctx.pipelineRunId,
    workspaceSessionId: ctx.workspaceSessionId,
    voiceCallId: ctx.voiceCallId,
    callSid: ctx.callSid,
    nativeCallWorkspaceSessionId: ctx.workspaceSessionId,
    ...fields,
  })
}
