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
