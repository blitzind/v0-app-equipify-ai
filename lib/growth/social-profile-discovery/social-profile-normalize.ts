/** Deterministic social profile URL normalization (7.5A). No guessing — URL required. */

import { normalizeLinkedIn } from "@/lib/growth/import/normalize"
import type { GrowthSocialProfileDiscoveryProfileType } from "@/lib/growth/social-profile-discovery/social-profile-discovery-types"

export type NormalizedSocialProfileResult = {
  profile_url: string
  normalized_profile_key: string
}

function trimUrl(value: string): string {
  return value.trim().split("?")[0]?.replace(/\/$/, "") ?? value.trim()
}

function hostMatches(url: string, hosts: string[]): boolean {
  try {
    const withProto = url.includes("://") ? url : `https://${url}`
    const host = new URL(withProto).hostname.toLowerCase().replace(/^www\./, "")
    return hosts.some((h) => host === h || host.endsWith(`.${h}`))
  } catch {
    const lower = url.toLowerCase()
    return hosts.some((h) => lower.includes(h))
  }
}

function pathSegmentAfter(url: string, marker: string): string | null {
  try {
    const withProto = url.includes("://") ? url : `https://${url}`
    const path = new URL(withProto).pathname.toLowerCase()
    const idx = path.indexOf(marker)
    if (idx < 0) return null
    const rest = path.slice(idx + marker.length).replace(/^\/+/, "").split("/")[0]
    return rest?.replace(/\/$/, "") || null
  } catch {
    const lower = url.toLowerCase()
    const idx = lower.indexOf(marker)
    if (idx < 0) return null
    const rest = lower.slice(idx + marker.length).replace(/^\/+/, "").split("/")[0]
    return rest?.replace(/\/$/, "") || null
  }
}

export function normalizeLinkedInPersonProfile(
  url: string | null | undefined,
): NormalizedSocialProfileResult | null {
  const raw = (url ?? "").trim()
  if (!raw || !raw.toLowerCase().includes("linkedin.com")) return null
  if (raw.toLowerCase().includes("/company/")) return null

  const slug = normalizeLinkedIn(raw)
  if (slug && !slug.includes("/")) {
    const profile_url = raw.includes("://") ? trimUrl(raw) : `https://www.linkedin.com/in/${slug}`
    return { profile_url, normalized_profile_key: `linkedin:in:${slug.toLowerCase()}` }
  }

  const path = pathSegmentAfter(raw, "/in/")
  if (!path) return null
  const profile_url = trimUrl(raw.includes("://") ? raw : `https://www.linkedin.com/in/${path}`)
  return { profile_url, normalized_profile_key: `linkedin:in:${path.toLowerCase()}` }
}

export function normalizeLinkedInCompanyProfile(
  url: string | null | undefined,
): NormalizedSocialProfileResult | null {
  const raw = (url ?? "").trim()
  if (!raw || !raw.toLowerCase().includes("linkedin.com")) return null

  const slug = pathSegmentAfter(raw, "/company/")
  if (!slug) return null

  const profile_url = trimUrl(raw.includes("://") ? raw : `https://www.linkedin.com/company/${slug}`)
  return { profile_url, normalized_profile_key: `linkedin:co:${slug.toLowerCase()}` }
}

export function normalizeTwitterProfile(url: string | null | undefined): NormalizedSocialProfileResult | null {
  const raw = (url ?? "").trim()
  if (!raw) return null
  if (!hostMatches(raw, ["twitter.com", "x.com"])) return null

  const handle = pathSegmentAfter(raw, "/")
  if (!handle || ["home", "search", "intent", "share"].includes(handle)) return null
  if (handle.includes("/")) return null

  const profile_url = trimUrl(raw.includes("://") ? raw : `https://x.com/${handle}`)
  return { profile_url, normalized_profile_key: `twitter:${handle.toLowerCase()}` }
}

export function normalizeFacebookProfile(url: string | null | undefined): NormalizedSocialProfileResult | null {
  const raw = (url ?? "").trim()
  if (!raw || !hostMatches(raw, ["facebook.com", "fb.com"])) return null

  const path = pathSegmentAfter(raw, "facebook.com/")
  if (!path && raw.includes("://")) {
    try {
      const p = new URL(raw.includes("://") ? raw : `https://${raw}`).pathname
        .replace(/^\/+/, "")
        .split("/")[0]
      if (!p || ["pages", "groups", "events", "watch", "login"].includes(p)) return null
      const profile_url = trimUrl(raw)
      return { profile_url, normalized_profile_key: `facebook:${p.toLowerCase()}` }
    } catch {
      return null
    }
  }
  if (!path || ["pages", "groups", "events", "watch", "login", "profile.php"].includes(path)) return null

  const profile_url = trimUrl(raw.includes("://") ? raw : `https://www.facebook.com/${path}`)
  return { profile_url, normalized_profile_key: `facebook:${path.toLowerCase()}` }
}

export function normalizeInstagramProfile(url: string | null | undefined): NormalizedSocialProfileResult | null {
  const raw = (url ?? "").trim()
  if (!raw || !hostMatches(raw, ["instagram.com"])) return null

  let handle = pathSegmentAfter(raw, "/")
  if (!handle) {
    try {
      const p = new URL(raw.includes("://") ? raw : `https://${raw}`).pathname
        .replace(/^\/+/, "")
        .split("/")[0]
      handle = p || null
    } catch {
      return null
    }
  }
  if (!handle || ["p", "reel", "tv", "explore", "accounts"].includes(handle)) return null
  if (handle.includes("/")) return null

  const profile_url = trimUrl(raw.includes("://") ? raw : `https://www.instagram.com/${handle}`)
  return { profile_url, normalized_profile_key: `instagram:${handle.toLowerCase()}` }
}

export function normalizeSocialProfileUrl(
  profile_type: GrowthSocialProfileDiscoveryProfileType,
  url: string | null | undefined,
): NormalizedSocialProfileResult | null {
  switch (profile_type) {
    case "linkedin_person":
      return normalizeLinkedInPersonProfile(url)
    case "linkedin_company":
      return normalizeLinkedInCompanyProfile(url)
    case "twitter":
      return normalizeTwitterProfile(url)
    case "facebook":
      return normalizeFacebookProfile(url)
    case "instagram":
      return normalizeInstagramProfile(url)
    default:
      return null
  }
}

/** Map discovery profile_type to growth.person_profiles.profile_type column. */
export function canonicalPersonProfileTypeColumn(
  profile_type: GrowthSocialProfileDiscoveryProfileType,
): string {
  if (profile_type === "linkedin_person") return "linkedin_person"
  return profile_type
}
