import "server-only"

import {
  buildVoiceDropStatusWebhookUrl,
  buildVoiceDropTwimlWebhookUrl,
  readTwilioVoiceDropAccountSid,
  readTwilioVoiceDropAuthToken,
  readTwilioVoiceDropFromNumber,
} from "@/lib/voice/voice-drops/twilio-voice-drop-config"

export type TwilioVoiceDropCallCreateInput = {
  organizationId: string
  campaignId: string
  recipientId: string
  phoneNumber: string
  publicOrigin?: string | null
}

export type TwilioVoiceDropCallCreateResult =
  | { ok: true; callSid: string; status: string }
  | { ok: false; code: string; message: string }

type TwilioVoiceDropCallCreateOverride = (
  input: TwilioVoiceDropCallCreateInput,
) => Promise<TwilioVoiceDropCallCreateResult>

let voiceDropTwilioCallCreateOverride: TwilioVoiceDropCallCreateOverride | null = null

/** Test-only hook — certification harness sets this to avoid live Twilio API calls. */
export function setVoiceDropTwilioCallCreateOverrideForTests(override: TwilioVoiceDropCallCreateOverride | null): void {
  voiceDropTwilioCallCreateOverride = override
}

export async function createTwilioVoiceDropOutboundCall(
  input: TwilioVoiceDropCallCreateInput,
): Promise<TwilioVoiceDropCallCreateResult> {
  if (voiceDropTwilioCallCreateOverride) {
    return voiceDropTwilioCallCreateOverride(input)
  }
  const accountSid = readTwilioVoiceDropAccountSid()
  const authToken = readTwilioVoiceDropAuthToken()
  const fromNumber = readTwilioVoiceDropFromNumber()

  if (!accountSid || !authToken) {
    return { ok: false, code: "twilio_not_configured", message: "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required." }
  }
  if (!fromNumber) {
    return { ok: false, code: "from_number_missing", message: "Set TWILIO_VOICE_FROM_NUMBER for voice drop outbound." }
  }

  const twimlUrl = buildVoiceDropTwimlWebhookUrl({
    origin: input.publicOrigin,
    organizationId: input.organizationId,
    recipientId: input.recipientId,
  })
  const statusUrl = buildVoiceDropStatusWebhookUrl({
    origin: input.publicOrigin,
    organizationId: input.organizationId,
    recipientId: input.recipientId,
  })

  try {
    const twilio = await import("twilio")
    const client = twilio.default(accountSid, authToken)

    const call = await client.calls.create({
      to: input.phoneNumber,
      from: fromNumber,
      url: twimlUrl,
      method: "POST",
      statusCallback: statusUrl,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      machineDetection: "DetectMessageEnd",
      machineDetectionTimeout: 30,
      machineDetectionSpeechThreshold: 2400,
      machineDetectionSpeechEndThreshold: 1200,
      machineDetectionSilenceTimeout: 5000,
      asyncAmd: false,
    })

    return { ok: true, callSid: call.sid, status: call.status ?? "queued" }
  } catch (error) {
    return {
      ok: false,
      code: "twilio_call_create_failed",
      message: error instanceof Error ? error.message : "Twilio call creation failed.",
    }
  }
}

export async function fetchTwilioVoiceDropCall(callSid: string): Promise<{
  ok: boolean
  status?: string
  answeredBy?: string | null
  durationSeconds?: number | null
  message?: string
}> {
  const accountSid = readTwilioVoiceDropAccountSid()
  const authToken = readTwilioVoiceDropAuthToken()
  if (!accountSid || !authToken) {
    return { ok: false, message: "Twilio is not configured." }
  }

  try {
    const twilio = await import("twilio")
    const client = twilio.default(accountSid, authToken)
    const call = await client.calls(callSid).fetch()
    const answeredBy =
      typeof call.answeredBy === "string"
        ? call.answeredBy
        : typeof (call as { answered_by?: string }).answered_by === "string"
          ? (call as { answered_by?: string }).answered_by
          : null
    const duration =
      typeof call.duration === "string"
        ? Number.parseInt(call.duration, 10)
        : typeof call.duration === "number"
          ? call.duration
          : null

    return {
      ok: true,
      status: call.status ?? undefined,
      answeredBy,
      durationSeconds: Number.isFinite(duration) ? duration : null,
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Twilio call fetch failed.",
    }
  }
}

export async function cancelTwilioVoiceDropCall(callSid: string): Promise<{ canceled: boolean; reason: string | null }> {
  const accountSid = readTwilioVoiceDropAccountSid()
  const authToken = readTwilioVoiceDropAuthToken()
  if (!accountSid || !authToken) {
    return { canceled: false, reason: "Twilio is not configured." }
  }

  try {
    const twilio = await import("twilio")
    const client = twilio.default(accountSid, authToken)
    await client.calls(callSid).update({ status: "canceled" })
    return { canceled: true, reason: null }
  } catch (error) {
    return {
      canceled: false,
      reason: error instanceof Error ? error.message : "Twilio cancel failed.",
    }
  }
}
