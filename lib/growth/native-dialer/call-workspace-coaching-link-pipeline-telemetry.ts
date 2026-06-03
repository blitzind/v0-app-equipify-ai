import "server-only"

import { logVoiceInfrastructure } from "@/lib/voice/telemetry"
import {
  COACHING_LINK_PIPELINE_QA_MARKER,
  type CoachingLinkPipelineStageLogInput,
} from "@/lib/growth/native-dialer/call-workspace-coaching-link-pipeline-types"

export {
  buildCoachingLinkPipelineRunId,
  COACHING_LINK_PIPELINE_QA_MARKER,
  type CoachingLinkPipelineStage,
  type CoachingLinkPipelineStageLogInput,
  type CoachingLinkPipelineStageOutcome,
  type CoachingLinkPipelineTelemetryContext,
} from "@/lib/growth/native-dialer/call-workspace-coaching-link-pipeline-types"

export function logCoachingLinkPipelineStage(input: CoachingLinkPipelineStageLogInput): void {
  logVoiceInfrastructure("voice_growth_coaching_link_pipeline_stage", {
    qaMarker: COACHING_LINK_PIPELINE_QA_MARKER,
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
  })
}
