/** Deterministic social URL extraction from HTML text (client-safe). */

import type { GrowthSocialProfileDiscoveryProfileType } from "@/lib/growth/social-profile-discovery/social-profile-discovery-types"

export type ExtractedSocialProfileUrl = {
  profile_type: GrowthSocialProfileDiscoveryProfileType
  profile_url: string
}

const PATTERNS: Array<{ profile_type: GrowthSocialProfileDiscoveryProfileType; regex: RegExp }> = [
  { profile_type: "linkedin_person", regex: /https?:\/\/(?:[\w.-]+\.)?linkedin\.com\/in\/[\w%-]+/gi },
  { profile_type: "linkedin_company", regex: /https?:\/\/(?:[\w.-]+\.)?linkedin\.com\/company\/[\w%-]+/gi },
  {
    profile_type: "twitter",
    regex: /https?:\/\/(?:[\w.-]+\.)?(?:twitter\.com|x\.com)\/[\w%-]+/gi,
  },
  { profile_type: "facebook", regex: /https?:\/\/(?:[\w.-]+\.)?(?:facebook\.com|fb\.com)\/[\w%.-]+/gi },
  {
    profile_type: "instagram",
    regex: /https?:\/\/(?:[\w.-]+\.)?instagram\.com\/[\w%.-]+/gi,
  },
]

export function extractSocialProfileUrlsFromText(text: string): ExtractedSocialProfileUrl[] {
  const out: ExtractedSocialProfileUrl[] = []
  const seen = new Set<string>()

  for (const { profile_type, regex } of PATTERNS) {
    const matches = text.match(regex) ?? []
    for (const raw of matches) {
      const profile_url = raw.split("?")[0]?.replace(/\/$/, "") ?? raw
      const key = `${profile_type}:${profile_url.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ profile_type, profile_url })
    }
  }

  return out
}
