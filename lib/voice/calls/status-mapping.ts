import type { VoiceCallStatus, VoiceProviderId } from "@/lib/voice/types"

const TWILIO_STATUS_MAP: Record<string, VoiceCallStatus> = {
  queued: "queued",
  initiated: "initiated",
  ringing: "ringing",
  "in-progress": "in_progress",
  in_progress: "in_progress",
  completed: "completed",
  failed: "failed",
  busy: "busy",
  "no-answer": "no_answer",
  no_answer: "no_answer",
  canceled: "canceled",
  cancelled: "canceled",
}

export function mapProviderCallStatus(
  provider: VoiceProviderId,
  providerStatus: string | null | undefined,
): VoiceCallStatus | null {
  if (!providerStatus) return null
  const normalized = providerStatus.trim().toLowerCase()
  if (!normalized) return null

  switch (provider) {
    case "twilio":
      return TWILIO_STATUS_MAP[normalized] ?? null
    case "telnyx":
    case "plivo":
    case "sip":
    case "stub":
      return TWILIO_STATUS_MAP[normalized] ?? null
    default:
      return null
  }
}

export function mapTwilioCallStatusEvent(callStatus: string | null | undefined): VoiceCallStatus | null {
  return mapProviderCallStatus("twilio", callStatus)
}
