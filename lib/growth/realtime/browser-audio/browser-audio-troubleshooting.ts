/** Client-safe browser mic troubleshooting copy (Growth Engine slice 6.12F). */

export const BROWSER_AUDIO_TROUBLESHOOTING = {
  microphonePermissionDenied:
    "Microphone access was denied. Allow mic permission in your browser settings, then retry capture.",
  providerNotConfigured:
    "No live transcript provider is configured. Select and validate a provider in Live Coaching settings.",
  providerDegraded:
    "The active provider is temporarily degraded. Wait for recovery or switch providers in Live Coaching settings.",
  providerUnavailable:
    "Provider transcript streaming is unavailable. Manual transcript mode remains available.",
  providerCircuitOpen:
    "The active provider circuit is open after repeated failures. Retry after cooldown or choose another provider.",
  retryCooldownActive:
    "Provider validation is in cooldown. Wait a moment, then run Test Connection again.",
  unsupportedBrowser:
    "This browser does not support live microphone capture for coaching. Use manual transcript mode or a supported browser.",
  doubleStartBlocked:
    "Mic capture is already active for this session. Pause or stop before starting again.",
  staleSession:
    "Mic capture was reset because the coaching session changed. Start capture again when ready.",
  sessionNotLive:
    "Go live on the realtime session before starting mic capture.",
  fallbackManualMode:
    "Manual transcript mode is active while the selected provider is unavailable.",
  meetingCaptureUnavailable:
    "Meeting tab capture is unavailable in this browser. Use microphone capture or manual transcript mode.",
  meetingAudioPermissionDenied:
    "Browser tab or system audio sharing was denied. Choose a meeting tab and allow audio sharing, then retry.",
  meetingCaptureFailed:
    "Meeting capture could not start. Retry tab sharing or fall back to microphone capture.",
} as const

export type BrowserAudioTroubleshootingCode = keyof typeof BROWSER_AUDIO_TROUBLESHOOTING

export function browserAudioTroubleshootingMessage(code: BrowserAudioTroubleshootingCode): string {
  return BROWSER_AUDIO_TROUBLESHOOTING[code]
}

export function resolveMicrophonePermissionError(raw: string): string {
  const normalized = raw.toLowerCase()
  if (
    normalized.includes("permission") ||
    normalized.includes("denied") ||
    normalized.includes("notallowed") ||
    normalized.includes("not allowed")
  ) {
    return BROWSER_AUDIO_TROUBLESHOOTING.microphonePermissionDenied
  }
  return raw.trim() || BROWSER_AUDIO_TROUBLESHOOTING.microphonePermissionDenied
}

export function resolveMeetingCapturePermissionError(raw: string): string {
  const normalized = raw.toLowerCase()
  if (
    normalized.includes("permission") ||
    normalized.includes("denied") ||
    normalized.includes("notallowed") ||
    normalized.includes("not allowed") ||
    normalized.includes("abort")
  ) {
    return BROWSER_AUDIO_TROUBLESHOOTING.meetingAudioPermissionDenied
  }
  return raw.trim() || BROWSER_AUDIO_TROUBLESHOOTING.meetingCaptureFailed
}
