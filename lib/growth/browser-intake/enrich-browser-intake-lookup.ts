import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { formatBrowserIntakeMatchRuleLabel } from "@/lib/growth/browser-intake/browser-intake-match-labels"
import {
  readBrowserIntakeCaptureType,
  readBrowserIntakeReviewStatus,
  readBrowserIntakeVerificationStatus,
} from "@/lib/growth/browser-intake/browser-intake-lookup-status"
import type {
  BrowserIntakeLeadLookupEnrichedMatch,
  BrowserIntakeLeadLookupMatch,
} from "@/lib/growth/browser-intake/browser-intake-types"
import {
  formatLinkedInLeadMatchSummary,
  GROWTH_LINKEDIN_EXTENSION_STATUS_BADGE_LABELS,
  resolveLinkedInLeadStatusBadge,
} from "@/lib/growth/browser-intake/linkedin-lead-status-badge"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"

export async function enrichBrowserIntakeLookupMatch(
  admin: SupabaseClient,
  match: BrowserIntakeLeadLookupMatch,
): Promise<BrowserIntakeLeadLookupEnrichedMatch> {
  const lead = await fetchGrowthLeadById(admin, match.lead_id)
  const matchLabel = formatBrowserIntakeMatchRuleLabel(match.rule)

  if (!lead) {
    const statusBadge = resolveLinkedInLeadStatusBadge({
      matched: true,
      confidence: match.confidence,
    })
    return {
      ...match,
      match_label: matchLabel,
      review_status: "needs_review",
      verification_status: "none",
      capture_type: "contact",
      status_badge: statusBadge,
      status_badge_label: GROWTH_LINKEDIN_EXTENSION_STATUS_BADGE_LABELS[statusBadge],
      match_summary: formatLinkedInLeadMatchSummary({
        match_label: matchLabel,
        confidence: match.confidence,
      }),
    }
  }

  const metadata = lead.metadata ?? {}
  const reviewStatus = readBrowserIntakeReviewStatus(metadata)
  const verificationStatus = readBrowserIntakeVerificationStatus(metadata)
  const captureType = readBrowserIntakeCaptureType(metadata, {
    contactName: lead.contactName,
    contactEmail: lead.contactEmail,
    contactPhone: lead.contactPhone,
  })
  const statusBadge = resolveLinkedInLeadStatusBadge({
    matched: true,
    confidence: match.confidence,
    capture_type: captureType,
    review_status: reviewStatus,
    verification_status: verificationStatus,
  })

  return {
    ...match,
    match_label: matchLabel,
    review_status: reviewStatus,
    verification_status: verificationStatus,
    capture_type: captureType,
    status_badge: statusBadge,
    status_badge_label: GROWTH_LINKEDIN_EXTENSION_STATUS_BADGE_LABELS[statusBadge],
    match_summary: formatLinkedInLeadMatchSummary({
      match_label: matchLabel,
      confidence: match.confidence,
    }),
  }
}

export async function enrichBrowserIntakeLookupMatches(
  admin: SupabaseClient,
  matches: BrowserIntakeLeadLookupMatch[],
): Promise<BrowserIntakeLeadLookupEnrichedMatch[]> {
  return Promise.all(matches.map((match) => enrichBrowserIntakeLookupMatch(admin, match)))
}
