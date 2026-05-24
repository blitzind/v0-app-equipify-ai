/** Client-safe browser audio capture guardrails (Growth Engine slice 6.12F). */

import type { GrowthBrowserAudioCaptureStatus } from "@/lib/growth/realtime/browser-audio/browser-audio-capture-types"

export function isStaleBrowserAudioSessionBinding(input: {
  boundSessionId: string | null
  activeSessionId: string | null
}): boolean {
  if (!input.boundSessionId || !input.activeSessionId) return false
  return input.boundSessionId !== input.activeSessionId
}

export function canStartBrowserAudioCaptureGuard(input: {
  captureStatus: GrowthBrowserAudioCaptureStatus
  starting: boolean
}): { allowed: boolean; reason: "double_start" | null } {
  if (input.starting) return { allowed: false, reason: "double_start" }
  if (input.captureStatus === "active" || input.captureStatus === "requesting") {
    return { allowed: false, reason: "double_start" }
  }
  return { allowed: true, reason: null }
}

export function isDuplicateBrowserAudioChunkSequence(input: {
  lastSequenceNumber: number | null
  nextSequenceNumber: number
}): boolean {
  if (input.lastSequenceNumber === null) return false
  return input.nextSequenceNumber <= input.lastSequenceNumber
}

export function isBrowserAudioCaptureTerminalStatus(status: GrowthBrowserAudioCaptureStatus): boolean {
  return status === "stopped" || status === "failed" || status === "inactive"
}
