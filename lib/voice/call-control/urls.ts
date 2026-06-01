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

export type VoiceMediaStreamOriginSource =
  | "env_voice_media_stream_public_origin"
  | "env_next_public_site_url"
  | "request_origin"
  | "fallback_placeholder"

/** Resolve the public HTTPS origin Twilio should use for Media Stream WSS URLs. */
export function resolveVoiceMediaStreamPublicBaseUrl(origin?: string | null): {
  baseUrl: string
  originSource: VoiceMediaStreamOriginSource
} {
  const configured = process.env.VOICE_MEDIA_STREAM_PUBLIC_ORIGIN?.trim()?.replace(/\/$/, "")
  if (configured) {
    return { baseUrl: configured, originSource: "env_voice_media_stream_public_origin" }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()?.replace(/\/$/, "")
  if (siteUrl) {
    return { baseUrl: siteUrl, originSource: "env_next_public_site_url" }
  }

  const requestOrigin = origin?.trim()?.replace(/\/$/, "")
  if (requestOrigin) {
    return { baseUrl: requestOrigin, originSource: "request_origin" }
  }

  return { baseUrl: "https://your-deployment.example", originSource: "fallback_placeholder" }
}

export function buildVoiceMediaStreamTwilioUrl(origin?: string | null): string {
  const { baseUrl } = resolveVoiceMediaStreamPublicBaseUrl(origin)
  return `${baseUrl}/api/voice/media/twilio`
}

export function describeVoiceMediaStreamWssTarget(origin?: string | null): {
  wssUrl: string
  wssHost: string
  originSource: VoiceMediaStreamOriginSource
} {
  const wssUrl = buildVoiceMediaStreamTwilioWssUrl(origin)
  let wssHost = "unknown"
  try {
    wssHost = new URL(wssUrl).host
  } catch {
    wssHost = wssUrl.replace(/^wss:\/\//, "").split("/")[0] ?? "unknown"
  }
  const { originSource } = resolveVoiceMediaStreamPublicBaseUrl(origin)
  return { wssUrl, wssHost, originSource }
}

/** Twilio `<Stream url>` expects wss:// — convert configured public origin accordingly. */
export function buildVoiceMediaStreamTwilioWssUrl(origin?: string | null): string {
  const httpUrl = buildVoiceMediaStreamTwilioUrl(origin)
  if (httpUrl.startsWith("https://")) {
    return `wss://${httpUrl.slice("https://".length)}`
  }
  if (httpUrl.startsWith("http://")) {
    return `ws://${httpUrl.slice("http://".length)}`
  }
  if (httpUrl.startsWith("wss://") || httpUrl.startsWith("ws://")) {
    return httpUrl
  }
  return `wss://${httpUrl.replace(/^\/\//, "")}`
}

/** AI operator inbound webhook — Twilio Console voice URL for Equipify AI operator stub. */
export function buildTwilioVoiceIncomingUrl(origin?: string | null): string {
  const base = origin?.replace(/\/$/, "") || "https://your-deployment.example"
  return `${base}/api/twilio/voice/incoming`
}
