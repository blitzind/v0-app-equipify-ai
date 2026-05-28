import "server-only"

import { buildTwilioSayAndHangup } from "@/lib/voice/call-control/twilio-twiml"
import { createTwilioVoiceProvider } from "@/lib/voice/providers/twilio-provider"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

export const TWILIO_VOICE_INCOMING_QA_MARKER = "twilio-voice-incoming-v1" as const

export const TWILIO_VOICE_INCOMING_STUB_MESSAGE =
  "Thank you for calling Equipify. The AI voice system is being connected."

export type TwilioIncomingCallMetadata = {
  callSid: string | null
  from: string | null
  to: string | null
  direction: string | null
  accountSid: string | null
}

export function buildTwilioVoiceIncomingStubTwiml(): string {
  return buildTwilioSayAndHangup(TWILIO_VOICE_INCOMING_STUB_MESSAGE)
}

export function shouldSkipTwilioWebhookSignatureValidation(): boolean {
  const explicitSkip =
    process.env.TWILIO_WEBHOOK_SKIP_SIGNATURE_VALIDATION?.trim() === "true" ||
    process.env.VOICE_WEBHOOK_SKIP_SIGNATURE_VALIDATION?.trim() === "true"
  if (explicitSkip) return true

  if (process.env.NODE_ENV !== "production") {
    return !process.env.TWILIO_AUTH_TOKEN?.trim()
  }

  return false
}

export function extractTwilioIncomingCallMetadata(
  params: Record<string, string>,
): TwilioIncomingCallMetadata {
  return {
    callSid: params.CallSid?.trim() || null,
    from: params.From?.trim() || null,
    to: params.To?.trim() || null,
    direction: params.Direction?.trim() || null,
    accountSid: params.AccountSid?.trim() || null,
  }
}

export function logTwilioIncomingWebhookReceived(metadata: TwilioIncomingCallMetadata): void {
  logVoiceInfrastructure("twilio_voice_incoming_webhook", {
    qaMarker: TWILIO_VOICE_INCOMING_QA_MARKER,
    callSid: metadata.callSid,
    from: metadata.from,
    to: metadata.to,
    direction: metadata.direction,
    accountSid: metadata.accountSid,
  })
}

export async function validateTwilioIncomingWebhook(input: {
  signatureHeader: string | null
  requestUrl: string
  rawBody: string
  params: Record<string, string>
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (shouldSkipTwilioWebhookSignatureValidation()) {
    return { ok: true }
  }

  const twilio = createTwilioVoiceProvider()
  const validation = await twilio.validateWebhook({
    signatureHeader: input.signatureHeader,
    url: input.requestUrl,
    rawBody: input.rawBody,
    params: input.params,
  })

  if (!validation.ok) {
    return { ok: false, message: validation.message ?? "Twilio webhook signature validation failed." }
  }

  return { ok: true }
}
