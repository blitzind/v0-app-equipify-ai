/** Browser meeting provider detection from tab URL/title only — no provider APIs (slice 6.21A). */

import {
  GROWTH_MEETING_PROVIDERS,
  type GrowthMeetingProvider,
} from "@/lib/growth/realtime/browser-audio/meeting-capture-types"

const GOOGLE_MEET_PATTERN = /meet\.google\.com/i
const ZOOM_WEB_PATTERN = /(\.|\/\/)([a-z0-9-]+\.)?(zoom\.us|zoomgov\.com)/i
const TEAMS_WEB_PATTERN = /teams\.(microsoft\.com|live\.com)/i

export function detectMeetingProviderFromUrl(url: string | null | undefined): GrowthMeetingProvider {
  const normalized = (url ?? "").trim()
  if (!normalized) return "generic_browser_audio"
  if (GOOGLE_MEET_PATTERN.test(normalized)) return "google_meet"
  if (ZOOM_WEB_PATTERN.test(normalized)) return "zoom_web"
  if (TEAMS_WEB_PATTERN.test(normalized)) return "microsoft_teams_web"
  return "generic_browser_audio"
}

export function detectMeetingProviderFromDisplayMedia(input: {
  displaySurface?: string | null
  label?: string | null
  urlHint?: string | null
}): GrowthMeetingProvider {
  const fromUrl = detectMeetingProviderFromUrl(input.urlHint)
  if (fromUrl !== "generic_browser_audio") return fromUrl

  const label = (input.label ?? "").toLowerCase()
  if (label.includes("google meet") || label.includes("meet -")) return "google_meet"
  if (label.includes("zoom")) return "zoom_web"
  if (label.includes("teams") || label.includes("microsoft teams")) return "microsoft_teams_web"

  if (input.displaySurface === "browser") return "generic_browser_audio"
  return "generic_browser_audio"
}

export function isKnownMeetingProvider(provider: GrowthMeetingProvider): boolean {
  return GROWTH_MEETING_PROVIDERS.includes(provider) && provider !== "generic_browser_audio"
}
