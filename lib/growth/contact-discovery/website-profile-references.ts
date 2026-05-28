/** Safe LinkedIn/profile reference extraction from company websites — no scraping. Client-safe. */

import { GROWTH_PUBLIC_PROFILE_REFERENCE_QA_MARKER } from "@/lib/growth/contact-discovery/website-extraction-acquisition-types"

const LINKEDIN_PROFILE_RE = /https?:\/\/(?:[\w.-]+\.)?linkedin\.com\/in\/[\w%-]+/gi
const LINKEDIN_COMPANY_RE = /https?:\/\/(?:[\w.-]+\.)?linkedin\.com\/company\/[\w%-]+/gi

export function extractLinkedInProfileReferences(html: string): string[] {
  return [...new Set((html.match(LINKEDIN_PROFILE_RE) ?? []).map((url) => url.split("?")[0] ?? url))]
}

export function extractLinkedInCompanyReferences(html: string): string[] {
  return [...new Set((html.match(LINKEDIN_COMPANY_RE) ?? []).map((url) => url.split("?")[0] ?? url))]
}

export function buildLinkedInReferenceLabel(input: {
  profileUrl?: string | null
  companyUrl?: string | null
}): string | null {
  if (input.profileUrl) return "LinkedIn reference found on company website"
  if (input.companyUrl) return "LinkedIn company page linked from company website"
  return null
}

export function resolvePublicProfileReference(input: {
  profileUrl?: string | null
  companyUrl?: string | null
  sourcePageUrl: string
}) {
  return {
    qa_marker: GROWTH_PUBLIC_PROFILE_REFERENCE_QA_MARKER,
    linkedin_profile_url: input.profileUrl ?? null,
    linkedin_company_url: input.companyUrl ?? null,
    linkedin_reference_label: buildLinkedInReferenceLabel(input),
    profile_reference_verification: (input.profileUrl || input.companyUrl
      ? "website_linked"
      : "unverified") as "website_linked" | "unverified",
    source_page_url: input.sourcePageUrl,
  }
}
