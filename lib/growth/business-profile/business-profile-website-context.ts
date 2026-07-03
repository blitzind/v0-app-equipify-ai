import "server-only"

import { fetchLeadWebsite } from "@/lib/growth/research-website-fetch"
import {
  BUSINESS_PROFILE_WEBSITE_CONTEXT_MAX_CHARS,
  capBusinessProfileWebsiteContext,
} from "@/lib/growth/business-profile/business-profile-website-context-utils"

export type BusinessProfileWebsiteContextResult = {
  summary: string | null
  fetchStatus: string
  capped: boolean
}

export async function fetchBusinessProfileWebsiteContext(
  website: string,
): Promise<BusinessProfileWebsiteContextResult> {
  try {
    const fetchResult = await fetchLeadWebsite(website)
    if (fetchResult.status !== "ok" || !fetchResult.excerpt) {
      return { summary: null, fetchStatus: fetchResult.status, capped: false }
    }

    const raw = fetchResult.excerpt
    const cappedSummary = capBusinessProfileWebsiteContext(raw, BUSINESS_PROFILE_WEBSITE_CONTEXT_MAX_CHARS)
    return {
      summary: cappedSummary || null,
      fetchStatus: fetchResult.status,
      capped: cappedSummary.length < raw.replace(/\s+/g, " ").trim().length,
    }
  } catch {
    return { summary: null, fetchStatus: "error", capped: false }
  }
}
