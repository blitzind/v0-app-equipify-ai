import type { VoiceCallStatus } from "@/lib/voice/types"
import type { NativeCallSessionStatus } from "@/lib/growth/native-dialer/native-dialer-types"
import type { VoiceBrowserCallState } from "@/lib/voice/browser-calling/types"

export function buildVoiceBrowserClientIdentity(input: {
  organizationId: string
  userId: string
}): string {
  return `org_${input.organizationId.slice(0, 8)}_user_${input.userId}`
}

export function mapVoiceCallStatusToBrowserCallState(input: {
  voiceStatus: VoiceCallStatus | null | undefined
  muted?: boolean
  onHold?: boolean
  ending?: boolean
}): VoiceBrowserCallState {
  if (input.ending) return "ending"
  if (input.onHold) return "held"
  if (input.muted) return "muted"

  switch (input.voiceStatus) {
    case "queued":
    case "initiated":
      return "connecting"
    case "ringing":
      return "ringing"
    case "in_progress":
      return "active"
    case "completed":
    case "canceled":
      return "disconnected"
    case "failed":
    case "busy":
    case "no_answer":
      return "failed"
    default:
      return "idle"
  }
}

export function mapVoiceCallStatusToNativeSessionStatus(
  voiceStatus: VoiceCallStatus | null | undefined,
  input?: { onHold?: boolean },
): NativeCallSessionStatus {
  if (input?.onHold && voiceStatus === "in_progress") return "on_hold"
  switch (voiceStatus) {
    case "ringing":
    case "initiated":
    case "queued":
      return "ringing"
    case "in_progress":
      return "active"
    case "completed":
      return "completed"
    case "failed":
      return "failed"
    case "no_answer":
    case "busy":
      return "no_answer"
    case "canceled":
      return "missed"
    default:
      return "ringing"
  }
}

export function mapBrowserCallStateLabel(state: VoiceBrowserCallState): string {
  switch (state) {
    case "idle":
      return "Idle"
    case "connecting":
      return "Connecting"
    case "ringing":
      return "Ringing"
    case "active":
      return "Active"
    case "held":
      return "On hold"
    case "muted":
      return "Muted"
    case "ending":
      return "Ending"
    case "disconnected":
      return "Disconnected"
    case "failed":
      return "Failed"
    default:
      return state
  }
}

export const VOICE_CALL_TIMELINE_EVENT_LABELS: Record<string, string> = {
  initiated: "Call initiated",
  ringing: "Ringing",
  answered: "Answered",
  in_progress: "Call active",
  held: "Placed on hold",
  resumed: "Resumed",
  muted: "Muted",
  unmuted: "Unmuted",
  recording_started: "Recording started",
  recording_stopped: "Recording stopped",
  voicemail_left: "Voicemail left",
  completed: "Call ended",
  failed: "Call failed",
  no_answer: "No answer",
  busy: "Busy",
  canceled: "Canceled",
  transfer_requested: "Transfer requested (placeholder)",
}
