import type { GrowthIntentPixelSite } from "@/lib/growth/intent-pixel/intent-pixel-types"
import {
  GROWTH_INTENT_PIXEL_TRACKING_MODES,
  type GrowthIntentPixelTrackingMode,
} from "@/lib/growth/intent-pixel/intent-pixel-admin-types"

export function trackingModeFromSite(site: Pick<GrowthIntentPixelSite, "tracking_enabled" | "consent_required">): GrowthIntentPixelTrackingMode {
  if (!site.tracking_enabled) return "disabled"
  if (site.consent_required) return "consent_gated"
  return "always_on"
}

export function siteFlagsFromTrackingMode(mode: GrowthIntentPixelTrackingMode): {
  tracking_enabled: boolean
  consent_required: boolean
} {
  if (mode === "disabled") {
    return { tracking_enabled: false, consent_required: true }
  }
  if (mode === "always_on") {
    return { tracking_enabled: true, consent_required: false }
  }
  return { tracking_enabled: true, consent_required: true }
}

export function trackingModeLabel(mode: GrowthIntentPixelTrackingMode): string {
  if (mode === "disabled") return "Disabled"
  if (mode === "always_on") return "Always on (consent not required)"
  return "Consent-gated"
}

export function isValidIntentPixelSiteKey(siteKey: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{1,62}$/.test(siteKey)
}

export function normalizeDomainAllowlist(domains: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of domains) {
    const domain = raw.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0] ?? ""
    if (!domain || seen.has(domain)) continue
    seen.add(domain)
    out.push(domain)
  }
  return out
}

export function buildIntentPixelScriptSnippet(origin: string, siteKey: string): {
  pixel_script_url: string
  script_snippet: string
} {
  const pixel_script_url = `${origin.replace(/\/$/, "")}/api/growth/intent-pixel/pixel.js?site_key=${encodeURIComponent(siteKey)}`
  const script_snippet = `<script async src="${pixel_script_url}"></script>`
  return { pixel_script_url, script_snippet }
}

export function parseTrackingModeInput(value: unknown): GrowthIntentPixelTrackingMode | null {
  const raw = typeof value === "string" ? value.trim() : ""
  return GROWTH_INTENT_PIXEL_TRACKING_MODES.includes(raw as GrowthIntentPixelTrackingMode)
    ? (raw as GrowthIntentPixelTrackingMode)
    : null
}
