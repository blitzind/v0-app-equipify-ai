import { NextResponse } from "next/server"
import { z } from "zod"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { answerGrowthNativeCall } from "@/lib/growth/native-dialer/native-dialer-service"
import { GROWTH_NATIVE_DIALER_QA_MARKER } from "@/lib/growth/native-dialer/native-dialer-types"
import {
  growthNativeDialerSchemaResponseMeta,
  requireGrowthNativeDialerSchemaReadyWithBudget,
} from "@/lib/growth/native-dialer/native-dialer-schema-health"
import { logGrowthCallsAnswerValidationAudit } from "@/lib/voice/api/session-id-validation-diagnostics"
import { nativeSessionIdSchema } from "@/lib/voice/api/native-session-id-validation"
import { logCoachingLinkPipelineStage } from "@/lib/growth/native-dialer/call-workspace-coaching-link-pipeline-telemetry"
import { requireVoiceOperatorRouteContext } from "@/lib/voice/api/voice-operator-route"

export const runtime = "nodejs"
export const maxDuration = 60

const bodySchema = z.object({
  sessionId: nativeSessionIdSchema,
})

const LIVE_COACHING_AUTO_START_QA_MARKER = "growth-live-coaching-auto-start-qa-v1" as const

function logLiveCoachingAutoStartQa(event: string, details: Record<string, unknown>): void {
  console.info(
    JSON.stringify({
      source: "growth-calls-answer-route",
      qaMarker: LIVE_COACHING_AUTO_START_QA_MARKER,
      event,
      ts: new Date().toISOString(),
      ...details,
    }),
  )
}

export async function POST(request: Request) {
  const routeStartedAt = Date.now()
  const pipelineRunId = request.headers.get("x-coaching-pipeline-run-id")?.trim() || null
  const rawBody = await request.json().catch(() => ({}))
  const parsed = bodySchema.safeParse(rawBody)
  if (!parsed.success) {
    logGrowthCallsAnswerValidationAudit("zod_rejected", {
      branch: "invalid_body",
      sessionId:
        typeof rawBody === "object" &&
        rawBody !== null &&
        "sessionId" in rawBody &&
        typeof (rawBody as { sessionId?: unknown }).sessionId === "string"
          ? (rawBody as { sessionId: string }).sessionId
          : null,
      zodIssues: parsed.error.issues.map((issue) => issue.message),
    })
    return NextResponse.json({ error: "invalid_body", message: "Invalid answer payload." }, { status: 400 })
  }

  const sessionId = parsed.data.sessionId.trim()
  logCoachingLinkPipelineStage({
    stage: "server_calls_answer_route",
    outcome: "entered",
    pipelineRunId,
    workspaceSessionId: sessionId,
    nativeCallWorkspaceSessionId: sessionId,
    durationMs: Date.now() - routeStartedAt,
  })
  logGrowthCallsAnswerValidationAudit("pre_operator_guard", {
    branch: "zod_accepted",
    sessionId,
  })

  const schemaAdmin = createServiceRoleSupabaseClient()
  const [access, schemaGate] = await Promise.all([
    requireVoiceOperatorRouteContext({
      request,
      sessionId,
      requireSessionOwner: true,
      skipSessionIdFormatValidation: true,
      sessionIdDiagnostics: {
        route: "POST /api/platform/growth/calls/answer",
        sessionIdSource: "json_body.sessionId",
        nativeSessionId: sessionId,
      },
    }),
    requireGrowthNativeDialerSchemaReadyWithBudget(schemaAdmin, 800),
  ])
  if (!access.ok) {
    logCoachingLinkPipelineStage({
      stage: "server_calls_answer_route",
      outcome: "failed",
      pipelineRunId,
      workspaceSessionId: sessionId,
      nativeCallWorkspaceSessionId: sessionId,
      durationMs: Date.now() - routeStartedAt,
      failureReason: "operator_guard_rejected",
      httpStatus: access.response.status,
    })
    logGrowthCallsAnswerValidationAudit("operator_guard_rejected", {
      branch: "operator_guard_rejected",
      sessionId,
    })
    return access.response
  }

  logGrowthCallsAnswerValidationAudit("operator_guard_accepted", {
    branch: "operator_guard_accepted",
    sessionId,
    nativeSessionId: access.session?.id ?? null,
    nativeSessionStatus: access.session?.status ?? null,
    nativeSessionOwnerUserId: access.session?.owner_user_id ?? null,
  })

  if (!schemaGate.ok) {
    logCoachingLinkPipelineStage({
      stage: "server_calls_answer_route",
      outcome: "failed",
      pipelineRunId,
      workspaceSessionId: sessionId,
      nativeCallWorkspaceSessionId: sessionId,
      durationMs: Date.now() - routeStartedAt,
      failureReason: "schema_not_ready",
      httpStatus: schemaGate.status,
    })
    return NextResponse.json(
      {
        ok: false,
        message: schemaGate.probe.setupMessage,
        meta: growthNativeDialerSchemaResponseMeta(schemaGate.probe),
      },
      { status: schemaGate.status },
    )
  }

  logLiveCoachingAutoStartQa("answer_api_request_start", {
    sessionId,
    ownerUserId: access.userId,
  })

  try {
    const { session, pipeline } = await answerGrowthNativeCall(
      access.admin,
      sessionId,
      access.userId,
      { pipelineRunId },
    )
    logCoachingLinkPipelineStage({
      stage: "server_answer_response",
      outcome: pipeline.liveCoachingLinked
        ? "completed"
        : pipeline.coachingLinkPending
          ? "skipped"
          : "failed",
      pipelineRunId,
      workspaceSessionId: sessionId,
      nativeCallWorkspaceSessionId: session.id,
      nativeCallWorkspaceRealtimeSessionId: session.realtimeSessionId,
      realtimeSessionId: pipeline.realtimeSessionId ?? session.realtimeSessionId,
      voiceCallId: session.voiceCallId,
      callSid: session.providerCallRef ?? null,
      ownerUserId: access.userId,
      liveCoachingLinked: pipeline.liveCoachingLinked,
      linkResultLinked: pipeline.linkResult?.linked ?? null,
      linkResultReason: pipeline.linkResult?.reason ?? null,
      failureReason: pipeline.liveCoachingFailureReason,
      extra: {
        createdRealtimeSessionId: pipeline.createdRealtimeSessionId,
        liveCoachingError: pipeline.liveCoachingError,
      },
    })
    logCoachingLinkPipelineStage({
      stage: "server_calls_answer_route",
      outcome: "completed",
      pipelineRunId,
      workspaceSessionId: sessionId,
      nativeCallWorkspaceSessionId: session.id,
      nativeCallWorkspaceRealtimeSessionId: session.realtimeSessionId,
      realtimeSessionId: pipeline.realtimeSessionId ?? session.realtimeSessionId,
      voiceCallId: session.voiceCallId,
      callSid: session.providerCallRef ?? null,
      ownerUserId: access.userId,
      durationMs: Date.now() - routeStartedAt,
      liveCoachingLinked: pipeline.liveCoachingLinked,
      linkResultLinked: pipeline.linkResult?.linked ?? null,
      linkResultReason: pipeline.linkResult?.reason ?? null,
      failureReason: pipeline.liveCoachingFailureReason,
    })
    logLiveCoachingAutoStartQa("answer_api_response", {
      sessionId,
      responseSessionId: session.id,
      voiceCallId: session.voiceCallId,
      status: session.status,
      direction: session.direction,
      realtimeSessionId: session.realtimeSessionId,
      liveCoachingLinked: pipeline.liveCoachingLinked,
      liveCoachingFailureReason: pipeline.liveCoachingFailureReason,
      pipelineRealtimeSessionId: pipeline.realtimeSessionId,
      createdRealtimeSessionId: pipeline.createdRealtimeSessionId,
      linkResultLinked: pipeline.linkResult?.linked ?? null,
      linkResultReason: pipeline.linkResult?.reason ?? null,
    })
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_NATIVE_DIALER_QA_MARKER,
      session,
      pipeline,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not answer call."
    logCoachingLinkPipelineStage({
      stage: "server_calls_answer_route",
      outcome: "failed",
      pipelineRunId,
      workspaceSessionId: sessionId,
      nativeCallWorkspaceSessionId: sessionId,
      durationMs: Date.now() - routeStartedAt,
      failureReason: message,
      httpStatus: 500,
    })
    logLiveCoachingAutoStartQa("answer_api_response", {
      sessionId,
      ok: false,
      error: "answer_failed",
      message,
    })
    return NextResponse.json({ error: "answer_failed", message }, { status: 500 })
  }
}
