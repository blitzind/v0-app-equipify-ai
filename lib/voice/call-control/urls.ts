/** Public voice webhook URL helpers (client-safe). */

export function buildVoiceInboundTwilioUrl(origin?: string | null): string {
  const base = origin?.replace(/\/$/, "") || "https://your-deployment.example"
  return `${base}/api/voice/inbound/twilio`
}

export function buildVoiceStatusWebhookUrl(origin?: string | null): string {
  const base = origin?.replace(/\/$/, "") || "https://your-deployment.example"
  return `${base}/api/voice/webhooks/twilio`
}

export function buildVoiceRecordingCallbackUrl(origin?: string | null): string {
  const base = origin?.replace(/\/$/, "") || "https://your-deployment.example"
  return `${base}/api/voice/webhooks/twilio/recording`
}

export function buildVoiceMediaStreamTwilioUrl(origin?: string | null): string {
  const base = origin?.replace(/\/$/, "") || "https://your-deployment.example"
  const configured = process.env.VOICE_MEDIA_STREAM_PUBLIC_ORIGIN?.trim()
  const resolvedBase = configured?.replace(/\/$/, "") || base
  return `${resolvedBase}/api/voice/media/twilio`
}

/** AI operator inbound webhook — Twilio Console voice URL for Equipify AI operator stub. */
export function buildTwilioVoiceIncomingUrl(origin?: string | null): string {
  const base = origin?.replace(/\/$/, "") || "https://your-deployment.example"
  return `${base}/api/twilio/voice/incoming`
}
