/** LinkedIn page context detection — visible URL/title only, client-safe. */

import { cleanBrowserIntakePageUrl, detectBrowserIntakeSourcePlatform } from "@/lib/growth/browser-intake/page-metadata-extract"

export const GROWTH_LINKEDIN_PAGE_KINDS = ["profile", "company", "other"] as const

export type GrowthLinkedInPageKind = (typeof GROWTH_LINKEDIN_PAGE_KINDS)[number]

function trimOrNull(value: unknown): string | null {
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed ? trimmed : null
}

export function detectLinkedInPageKind(url: string | null | undefined): GrowthLinkedInPageKind | null {
  const raw = trimOrNull(url)
  if (!raw || detectBrowserIntakeSourcePlatform(raw) !== "linkedin") return null

  try {
    const path = new URL(raw).pathname.replace(/\/+$/, "")
    if (/^\/in\/[^/]+/i.test(path)) return "profile"
    if (/^\/company\/[^/]+/i.test(path)) return "company"
    return "other"
  } catch {
    return null
  }
}

export function normalizeLinkedInLookupUrl(url: string | null | undefined): string | null {
  const cleaned = cleanBrowserIntakePageUrl(url)
  if (!cleaned || detectBrowserIntakeSourcePlatform(cleaned) !== "linkedin") return null

  try {
    const parsed = new URL(cleaned)
    const kind = detectLinkedInPageKind(cleaned)
    if (kind === "profile") {
      const match = parsed.pathname.match(/^(\/in\/[^/]+)/i)
      if (match?.[1]) return `https://www.linkedin.com${match[1]}/`
    }
    if (kind === "company") {
      const match = parsed.pathname.match(/^(\/company\/[^/]+)/i)
      if (match?.[1]) return `https://www.linkedin.com${match[1]}/`
    }
    return cleaned
  } catch {
    return cleaned
  }
}

export function inferLinkedInProfileNameFromTitle(title: string | null | undefined): string | null {
  const raw = trimOrNull(title)
  if (!raw) return null

  const withoutLinkedIn = raw.replace(/\s*[|\-–—]\s*LinkedIn\s*$/i, "").trim()
  if (!withoutLinkedIn) return null

  const firstSegment = withoutLinkedIn.split(/\s*[|\-–—]\s*/)[0]?.trim()
  if (!firstSegment) return null

  const namePart = firstSegment.split(/\s+-\s+/)[0]?.trim()
  return trimOrNull(namePart) ?? trimOrNull(firstSegment)
}

export function buildLinkedInLookupQuery(input: {
  url?: string | null
  page_title?: string | null
  company_name?: string | null
  website?: string | null
  email?: string | null
  linkedin_url?: string | null
}): {
  linkedin_url: string | null
  company_name: string | null
  website: string | null
  email: string | null
  linkedin_page_kind: GrowthLinkedInPageKind | null
  contact_name: string | null
} {
  const linkedinUrl = normalizeLinkedInLookupUrl(input.linkedin_url ?? input.url)
  const pageKind = detectLinkedInPageKind(input.url ?? input.linkedin_url)
  const contactName =
    pageKind === "profile" ? inferLinkedInProfileNameFromTitle(input.page_title) : null

  return {
    linkedin_url: linkedinUrl,
    company_name: trimOrNull(input.company_name),
    website: trimOrNull(input.website),
    email: trimOrNull(input.email)?.toLowerCase() ?? null,
    linkedin_page_kind: pageKind,
    contact_name: contactName,
  }
}
