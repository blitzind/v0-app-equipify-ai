import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { answerGrowthNativeCall } from "@/lib/growth/native-dialer/native-dialer-service"
import { GROWTH_NATIVE_DIALER_QA_MARKER } from "@/lib/growth/native-dialer/native-dialer-types"
import {
  growthNativeDialerSchemaResponseMeta,
  requireGrowthNativeDialerSchemaReady,
} from "@/lib/growth/native-dialer/native-dialer-schema-health"

export const runtime = "nodejs"
export const maxDuration = 60

const bodySchema = z.object({
  sessionId: z.string().uuid(),
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
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const schemaGate = await requireGrowthNativeDialerSchemaReady(access.admin)
  if (!schemaGate.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: schemaGate.probe.setupMessage,
        meta: growthNativeDialerSchemaResponseMeta(schemaGate.probe),
      },
      { status: schemaGate.status },
    )
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid answer payload." }, { status: 400 })
  }

  logLiveCoachingAutoStartQa("answer_api_request_start", {
    sessionId: parsed.data.sessionId,
    ownerUserId: access.userId,
  })

  try {
    const { session, pipeline } = await answerGrowthNativeCall(
      access.admin,
      parsed.data.sessionId,
      access.userId,
    )
    logLiveCoachingAutoStartQa("answer_api_response", {
      sessionId: parsed.data.sessionId,
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
    logLiveCoachingAutoStartQa("answer_api_response", {
      sessionId: parsed.data.sessionId,
      ok: false,
      error: "answer_failed",
      message,
    })
    return NextResponse.json({ error: "answer_failed", message }, { status: 500 })
  }
}
