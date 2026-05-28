import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isGrowthEngineEnabledEnv } from "@/lib/growth/access"
import { buildVoiceMediaStreamTwilioUrl } from "@/lib/voice/call-control/urls"
import { parseTwilioMediaStreamMessage } from "@/lib/voice/media-streaming/twilio-media-parser"
import {
  processTwilioMediaStreamMessage,
  resolveOrganizationForTwilioMediaStream,
} from "@/lib/voice/media-streaming/media-session-service"
import { VOICE_MEDIA_STREAMING_QA_MARKER } from "@/lib/voice/media-streaming/types"
import { probeVoiceSchemaHealth, isVoiceWebhookSchemaReady } from "@/lib/voice/schema-health"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

export const runtime = "nodejs"

function websocketUpgradeRequested(request: Request): boolean {
  return request.headers.get("upgrade")?.toLowerCase() === "websocket"
}

export async function GET(request: Request) {
  if (!isGrowthEngineEnabledEnv()) {
    return NextResponse.json({ error: "feature_disabled" }, { status: 403 })
  }

  if (websocketUpgradeRequested(request)) {
    const upgradeEnabled = process.env.VOICE_MEDIA_WEBSOCKET_UPGRADE_ENABLED?.trim() === "true"
    if (!upgradeEnabled) {
      return NextResponse.json(
        {
          ok: false,
          qaMarker: VOICE_MEDIA_STREAMING_QA_MARKER,
          error: "websocket_upgrade_requires_proxy",
          message:
            "Twilio Media Streams requires a websocket upgrade. Enable VOICE_MEDIA_WEBSOCKET_UPGRADE_ENABLED or terminate WSS at an external proxy that POSTs frames to this route.",
          mediaStreamUrl: buildVoiceMediaStreamTwilioUrl(request.headers.get("origin")),
        },
        { status: 426 },
      )
    }
    return NextResponse.json(
      {
        ok: false,
        qaMarker: VOICE_MEDIA_STREAMING_QA_MARKER,
        error: "websocket_custom_server_required",
        message: "Attach lib/voice/media-streaming/twilio-websocket-handler to your Node HTTP upgrade listener.",
      },
      { status: 501 },
    )
  }

  let admin
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_config" }, { status: 503 })
  }

  const schemaProbe = await probeVoiceSchemaHealth(admin)
  return NextResponse.json({
    ok: isVoiceWebhookSchemaReady(schemaProbe),
    qaMarker: VOICE_MEDIA_STREAMING_QA_MARKER,
    mediaStreamUrl: buildVoiceMediaStreamTwilioUrl(request.headers.get("origin")),
    schemaReady: schemaProbe.ready,
    message: "Twilio Media Streams ingestion endpoint scaffold is reachable.",
    supportedEvents: ["connected", "start", "media", "mark", "stop"],
  })
}

export async function POST(request: Request) {
  if (!isGrowthEngineEnabledEnv()) {
    return NextResponse.json({ error: "feature_disabled" }, { status: 403 })
  }

  let admin
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_config" }, { status: 503 })
  }

  const schemaProbe = await probeVoiceSchemaHealth(admin)
  if (!isVoiceWebhookSchemaReady(schemaProbe)) {
    return NextResponse.json({ error: "voice_schema_incomplete", message: schemaProbe.message }, { status: 503 })
  }

  const body = (await request.json().catch(() => null)) as
    | {
        frame?: string
        message?: string
        callSid?: string
        connectionId?: string
      }
    | null

  const raw = body?.frame ?? body?.message
  if (!raw || typeof raw !== "string") {
    return NextResponse.json({ error: "invalid_payload", message: "Provide frame JSON string." }, { status: 400 })
  }

  const frame = parseTwilioMediaStreamMessage(raw)
  if (!frame) {
    return NextResponse.json({ error: "invalid_frame", message: "Could not parse Twilio media stream frame." }, { status: 400 })
  }

  const callSid =
    frame.event === "start"
      ? frame.start.callSid
      : frame.event === "stop"
        ? frame.stop?.callSid
        : body?.callSid

  if (!callSid) {
    return NextResponse.json({ error: "missing_call_sid", message: "callSid required for stream frames." }, { status: 400 })
  }

  const resolved = await resolveOrganizationForTwilioMediaStream(admin, { callSid })
  if (!resolved) {
    return NextResponse.json({ error: "organization_unresolved" }, { status: 400 })
  }

  const connectionId = body?.connectionId ?? randomUUID()
  const result = await processTwilioMediaStreamMessage(admin, {
    connectionId,
    organizationId: resolved.organizationId,
    voiceCallId: resolved.voiceCallId,
    voiceConferenceId: resolved.voiceConferenceId,
    frame,
  })

  logVoiceInfrastructure("voice_media_stream_frame_processed", {
    qaMarker: VOICE_MEDIA_STREAMING_QA_MARKER,
    event: frame.event,
    callSid,
    ok: result.ok,
  })

  return NextResponse.json({
    ok: result.ok,
    qaMarker: VOICE_MEDIA_STREAMING_QA_MARKER,
    message: result.message,
    connectionId,
  })
}
