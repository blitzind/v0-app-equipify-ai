/** Twilio voice drop configuration — VD-1A (client-safe URL helpers + env gates). */

export const VOICE_DROP_TWILIO_VD_1A_QA_MARKER = "voice-drop-twilio-vd-1a" as const

export function readTwilioVoiceDropAccountSid(): string | null {
  return process.env.TWILIO_ACCOUNT_SID?.trim() || null
}

export function readTwilioVoiceDropAuthToken(): string | null {
  return process.env.TWILIO_AUTH_TOKEN?.trim() || null
}

export function readTwilioVoiceDropFromNumber(): string | null {
  return (
    process.env.TWILIO_VOICE_FROM_NUMBER?.trim() ||
    process.env.TWILIO_PHONE_NUMBER?.trim() ||
    null
  )
}

/** Live Twilio outbound requires explicit certification — autonomous outbound remains disabled. */
export function isVoiceDropTwilioOutboundCertified(): boolean {
  return process.env.VOICE_DROP_TWILIO_OUTBOUND_CERTIFIED === "true"
}

export function resolveVoiceDropTwilioPublicOrigin(): string {
  const configured =
    process.env.VOICE_MEDIA_STREAM_PUBLIC_ORIGIN?.trim()?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim()?.replace(/\/$/, "") ||
    ""
  return configured || "https://your-deployment.example"
}

export function buildVoiceDropTwimlWebhookUrl(input: {
  origin?: string | null
  organizationId: string
  recipientId: string
}): string {
  const base = (input.origin?.trim()?.replace(/\/$/, "") || resolveVoiceDropTwilioPublicOrigin()).replace(/\/$/, "")
  const params = new URLSearchParams({
    organizationId: input.organizationId,
    recipientId: input.recipientId,
  })
  return `${base}/api/voice/webhooks/twilio/voice-drop/twiml?${params.toString()}`
}

export function buildVoiceDropStatusWebhookUrl(input: {
  origin?: string | null
  organizationId: string
  recipientId: string
}): string {
  const base = (input.origin?.trim()?.replace(/\/$/, "") || resolveVoiceDropTwilioPublicOrigin()).replace(/\/$/, "")
  const params = new URLSearchParams({
    organizationId: input.organizationId,
    recipientId: input.recipientId,
  })
  return `${base}/api/voice/webhooks/twilio/voice-drop/status?${params.toString()}`
}

export function isTwilioVoiceDropCredentialsConfigured(): boolean {
  return Boolean(readTwilioVoiceDropAccountSid() && readTwilioVoiceDropAuthToken())
}

export function isTwilioVoiceDropConfigured(): boolean {
  return isTwilioVoiceDropCredentialsConfigured() && Boolean(readTwilioVoiceDropFromNumber())
}

export function canPlaceTwilioVoiceDropCalls(): boolean {
  return isTwilioVoiceDropConfigured() && isVoiceDropTwilioOutboundCertified()
}
