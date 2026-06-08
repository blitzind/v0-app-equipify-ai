/** Twilio voice drop TwiML — VD-1A AMD-aware playback (client-safe). */

export type VoiceDropTwimlAnsweredBy =
  | "human"
  | "machine_start"
  | "machine_end_beep"
  | "fax"
  | "unknown"
  | "pending"
  | string

export type VoiceDropTwimlInput = {
  answeredBy: VoiceDropTwimlAnsweredBy | null
  message: string
  voiceId?: string | null
  mediaUrl?: string | null
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export function normalizeVoiceDropAnsweredBy(raw: string | null | undefined): VoiceDropTwimlAnsweredBy {
  const value = raw?.trim().toLowerCase() ?? ""
  if (!value) return "pending"
  if (value === "human") return "human"
  if (value === "machine_start" || value === "machine") return "machine_start"
  if (value === "machine_end_beep" || value === "machine_end") return "machine_end_beep"
  if (value === "fax") return "fax"
  if (value === "unknown") return "unknown"
  return value
}

export function resolveVoiceDropPlayback(input: {
  voiceId?: string | null
  mediaUrl?: string | null
}): { mode: "say"; voice: string } | { mode: "play"; url: string } {
  const mediaUrl = input.mediaUrl?.trim() || null
  if (mediaUrl && /^https?:\/\//i.test(mediaUrl)) {
    return { mode: "play", url: mediaUrl }
  }

  const voiceId = input.voiceId?.trim() || null
  if (voiceId && /^https?:\/\//i.test(voiceId)) {
    return { mode: "play", url: voiceId }
  }

  if (voiceId && /^polly\./i.test(voiceId)) {
    return { mode: "say", voice: voiceId }
  }

  if (voiceId && voiceId.length > 0) {
    return { mode: "say", voice: voiceId.includes(".") ? voiceId : `Polly.${voiceId}` }
  }

  return { mode: "say", voice: "Polly.Joanna" }
}

function buildMessageBodyTwiml(message: string, playback: ReturnType<typeof resolveVoiceDropPlayback>): string {
  const trimmed = message.trim()
  if (!trimmed) {
    return "<Hangup/>"
  }

  if (playback.mode === "play") {
    return `<Play>${xmlEscape(playback.url)}</Play><Hangup/>`
  }

  return `<Say voice="${xmlEscape(playback.voice)}">${xmlEscape(trimmed)}</Say><Hangup/>`
}

export function buildVoiceDropOutboundTwiml(input: VoiceDropTwimlInput): string {
  const answeredBy = normalizeVoiceDropAnsweredBy(input.answeredBy)
  const playback = resolveVoiceDropPlayback({
    voiceId: input.voiceId,
    mediaUrl: input.mediaUrl,
  })

  if (answeredBy === "human") {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`
  }

  if (answeredBy === "fax" || answeredBy === "unknown") {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`
  }

  if (answeredBy === "machine_end_beep") {
    return `<?xml version="1.0" encoding="UTF-8"?><Response>${buildMessageBodyTwiml(input.message, playback)}</Response>`
  }

  if (answeredBy === "machine_start") {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Pause length="45"/></Response>`
  }

  return `<?xml version="1.0" encoding="UTF-8"?><Response><Pause length="30"/></Response>`
}

export function mapVoiceDropAnsweredByToDeliveryOutcome(answeredBy: VoiceDropTwimlAnsweredBy | null): {
  delivered: boolean
  failureReason: string | null
} {
  const normalized = normalizeVoiceDropAnsweredBy(answeredBy ?? null)
  if (normalized === "machine_end_beep") {
    return { delivered: true, failureReason: null }
  }
  if (normalized === "human") {
    return { delivered: false, failureReason: "human_answered_no_voicemail_drop" }
  }
  if (normalized === "machine_start") {
    return { delivered: false, failureReason: "voicemail_greeting_incomplete" }
  }
  if (normalized === "fax") {
    return { delivered: false, failureReason: "fax_detected" }
  }
  if (normalized === "unknown") {
    return { delivered: false, failureReason: "amd_unknown" }
  }
  return { delivered: false, failureReason: "amd_pending_or_inconclusive" }
}
