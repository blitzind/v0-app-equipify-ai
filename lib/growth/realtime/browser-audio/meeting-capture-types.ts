/** Client-safe meeting capture types (Growth Engine slice 6.21A). */

export const GROWTH_MEETING_CAPTURE_QA_MARKER = "meeting-capture-v1"

export const GROWTH_MEETING_CAPTURE_SOURCE_MODES = [
  "microphone",
  "browser_tab",
  "mixed_audio",
  "meeting_mode",
] as const

export type GrowthMeetingCaptureSourceMode = (typeof GROWTH_MEETING_CAPTURE_SOURCE_MODES)[number]

export const GROWTH_MEETING_PROVIDERS = [
  "google_meet",
  "zoom_web",
  "microsoft_teams_web",
  "generic_browser_audio",
] as const

export type GrowthMeetingProvider = (typeof GROWTH_MEETING_PROVIDERS)[number]

export const GROWTH_MEETING_PROVIDER_LABELS: Record<GrowthMeetingProvider, string> = {
  google_meet: "Google Meet",
  zoom_web: "Zoom",
  microsoft_teams_web: "Teams",
  generic_browser_audio: "Generic Browser Audio",
}

export const GROWTH_MEETING_CAPTURE_SOURCE_LABELS: Record<GrowthMeetingCaptureSourceMode, string> = {
  microphone: "Microphone",
  browser_tab: "Browser Tab",
  mixed_audio: "Mixed Audio",
  meeting_mode: "Meeting Mode",
}

export type GrowthMeetingCaptureIndicators = {
  meetingAudioActive: boolean
  microphoneActive: boolean
  mixedAudioActive: boolean
  meetingProvider: GrowthMeetingProvider | null
}

export function resolveMeetingCaptureSourceMode(input: {
  uiMode: "microphone" | "meeting_mode"
  includeMicrophone: boolean
}): GrowthMeetingCaptureSourceMode {
  if (input.uiMode === "microphone") return "microphone"
  if (input.includeMicrophone) return "mixed_audio"
  return "meeting_mode"
}
