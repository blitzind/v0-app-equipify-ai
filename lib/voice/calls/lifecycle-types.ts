import type { VoiceCallStatus } from "@/lib/voice/types"

export const VOICE_CALL_TERMINAL_STATUSES: VoiceCallStatus[] = [
  "completed",
  "failed",
  "busy",
  "no_answer",
  "canceled",
]

export type VoiceCallLifecycleTransitionResult =
  | { ok: true; nextStatus: VoiceCallStatus }
  | { ok: false; reason: string; currentStatus: VoiceCallStatus; attemptedStatus: VoiceCallStatus }
