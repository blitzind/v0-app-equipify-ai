import type { VoiceCallStatus } from "@/lib/voice/types"
import {
  VOICE_CALL_TERMINAL_STATUSES,
  type VoiceCallLifecycleTransitionResult,
} from "@/lib/voice/calls/lifecycle-types"

const ALLOWED_TRANSITIONS: Record<VoiceCallStatus, VoiceCallStatus[]> = {
  queued: ["initiated", "canceled", "failed"],
  initiated: ["ringing", "in_progress", "failed", "canceled", "busy", "no_answer"],
  ringing: ["in_progress", "completed", "failed", "busy", "no_answer", "canceled"],
  in_progress: ["completed", "failed", "canceled"],
  completed: [],
  failed: [],
  busy: [],
  no_answer: [],
  canceled: [],
}

export function isVoiceCallTerminalStatus(status: VoiceCallStatus): boolean {
  return VOICE_CALL_TERMINAL_STATUSES.includes(status)
}

export function canTransitionVoiceCallStatus(
  currentStatus: VoiceCallStatus,
  nextStatus: VoiceCallStatus,
): boolean {
  if (currentStatus === nextStatus) return true
  if (isVoiceCallTerminalStatus(currentStatus)) return false
  return ALLOWED_TRANSITIONS[currentStatus].includes(nextStatus)
}

export function assertVoiceCallStatusTransition(
  currentStatus: VoiceCallStatus,
  nextStatus: VoiceCallStatus,
): VoiceCallLifecycleTransitionResult {
  if (currentStatus === nextStatus) {
    return { ok: true, nextStatus }
  }
  if (!canTransitionVoiceCallStatus(currentStatus, nextStatus)) {
    return {
      ok: false,
      reason: `Invalid call lifecycle transition: ${currentStatus} -> ${nextStatus}`,
      currentStatus,
      attemptedStatus: nextStatus,
    }
  }
  return { ok: true, nextStatus }
}

export function mergeVoiceCallStatus(
  currentStatus: VoiceCallStatus,
  incomingStatus: VoiceCallStatus,
): VoiceCallLifecycleTransitionResult {
  if (currentStatus === incomingStatus) {
    return { ok: true, nextStatus: currentStatus }
  }
  if (isVoiceCallTerminalStatus(currentStatus)) {
    return { ok: true, nextStatus: currentStatus }
  }
  return assertVoiceCallStatusTransition(currentStatus, incomingStatus)
}
