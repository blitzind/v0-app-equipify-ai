import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isGrowthEngineEnabledEnv } from "@/lib/growth/access"
import { VOICE_CALL_CONTROL_QA_MARKER } from "@/lib/voice/call-control/types"
import { createTwilioVoiceProvider } from "@/lib/voice/providers/twilio-provider"
import { findVoiceCallByProviderId, resolveVoiceOrganizationFromWebhook } from "@/lib/voice/repository/voice-repository"
import { ingestVoicemailRecordingCallback } from "@/lib/voice/repository/voice-call-control-repository"
import { probeVoiceSchemaHealth, isVoiceWebhookSchemaReady } from "@/lib/voice/schema-health"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"
import { parseTwilioFormBody, twilioFormBodyToPayload } from "@/lib/voice/webhooks/normalizer"

export const runtime = "nodejs"

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

  const rawBody = await request.text()
  const formParams = parseTwilioFormBody(rawBody)
  const payload = twilioFormBodyToPayload(formParams)
  const signatureHeader = request.headers.get("x-twilio-signature")
  const skipSignatureValidation = process.env.VOICE_WEBHOOK_SKIP_SIGNATURE_VALIDATION?.trim() === "true"

  if (!skipSignatureValidation) {
    const twilio = createTwilioVoiceProvider()
    const validation = await twilio.validateWebhook({
      signatureHeader,
      url: request.url,
      rawBody,
      params: formParams,
    })
    if (!validation.ok) {
      return NextResponse.json({ error: "signature_failed", message: validation.message }, { status: 401 })
    }
  }

  const callSid = typeof payload.CallSid === "string" ? payload.CallSid : null
  const recordingSid = typeof payload.RecordingSid === "string" ? payload.RecordingSid : null
  if (!callSid || !recordingSid) {
    return NextResponse.json({ error: "invalid_payload", message: "Missing CallSid or RecordingSid." }, { status: 400 })
  }

  logVoiceInfrastructure("voice_recording_callback_received", {
    qaMarker: VOICE_CALL_CONTROL_QA_MARKER,
    providerCallId: callSid,
    providerRecordingId: recordingSid,
  })

  const organizationId = await resolveVoiceOrganizationFromWebhook(admin, {
    provider: "twilio",
    accountSid: typeof payload.AccountSid === "string" ? payload.AccountSid : null,
    fromNumber: typeof payload.From === "string" ? payload.From : null,
    toNumber: typeof payload.To === "string" ? payload.To : null,
  })

  if (!organizationId) {
    return NextResponse.json({ error: "organization_unresolved" }, { status: 400 })
  }

  const existingCall = await findVoiceCallByProviderId(admin, organizationId, "twilio", callSid)
  const durationRaw = payload.RecordingDuration ?? payload.CallDuration
  const durationSeconds =
    typeof durationRaw === "string" ? Number.parseInt(durationRaw, 10) : typeof durationRaw === "number" ? durationRaw : null

  const result = await ingestVoicemailRecordingCallback(admin, {
    organizationId,
    provider: "twilio",
    providerCallId: callSid,
    providerRecordingId: recordingSid,
    recordingUrl: typeof payload.RecordingUrl === "string" ? payload.RecordingUrl : null,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
    voicemailBoxId:
      typeof existingCall?.metadataJson?.voicemail_box_id === "string"
        ? existingCall.metadataJson.voicemail_box_id
        : null,
  })

  if (!result.ok) {
    return NextResponse.json({ error: "persistence_failed" }, { status: 500 })
  }

  logVoiceInfrastructure("voice_recording_callback_stored", {
    qaMarker: VOICE_CALL_CONTROL_QA_MARKER,
    organizationId,
    recordingId: result.recordingId,
  })

  return NextResponse.json({
    ok: true,
    qaMarker: VOICE_CALL_CONTROL_QA_MARKER,
    recordingId: result.recordingId,
  })
}
