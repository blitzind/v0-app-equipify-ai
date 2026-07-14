/** GE-AIOS-CHANNELS-1A — Canonical channel parity types (client-safe). */

export const GROWTH_AIOS_CHANNELS_1A_QA_MARKER =
  "ge-aios-channels-1a-canonical-channel-parity-v1" as const

export const CANONICAL_CHANNELS_1A = [
  "email",
  "linkedin",
  "sms",
  "call",
  "voicemail",
  "sendr",
  "follow_up",
  "meeting_request",
] as const

export type CanonicalChannels1AChannel = (typeof CANONICAL_CHANNELS_1A)[number]

/** Customer-facing labels — internal `sendr` channel is always Personalized Video. */
export const CUSTOMER_FACING_CHANNEL_LABELS: Record<CanonicalChannels1AChannel, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  sms: "SMS",
  call: "Call guide",
  voicemail: "Voicemail",
  sendr: "Personalized Video",
  follow_up: "Follow-up sequence",
  meeting_request: "Meeting request",
}

export const FORBIDDEN_FOLLOW_UP_PHRASES = [
  "following up",
  "follow up",
  "follow-up",
  "checking in",
  "check in",
  "circling back",
  "circle back",
  "touching base",
  "touch base",
] as const
