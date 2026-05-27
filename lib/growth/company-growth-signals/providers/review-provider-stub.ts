/** Review/reputation signal provider abstraction — stub only, no prohibited scraping. */

import type {
  RawEvidenceSourceCandidate,
  RawGrowthSignalCandidate,
} from "@/lib/growth/company-growth-signals/company-growth-signal-types"

export type ReviewProviderInput = {
  company_name: string
  domain: string | null
  review_count?: number | null
  rating?: number | null
}

export type ReviewProviderResult = {
  provider: "stub" | "manual"
  evidence: RawEvidenceSourceCandidate[]
  signals: RawGrowthSignalCandidate[]
}

export function fetchReviewReputationSignalsStub(input: ReviewProviderInput): ReviewProviderResult {
  const evidence: RawEvidenceSourceCandidate[] = []
  const signals: RawGrowthSignalCandidate[] = []

  if (input.review_count != null && input.review_count >= 50) {
    evidence.push({
      source_type: "review_site",
      source_url: input.domain ? `https://${input.domain}` : null,
      confidence_score: 60,
      evidence_excerpt: `${input.review_count} reviews observed in company discovery metadata`,
      metadata: { provider: "stub", review_count: input.review_count },
    })
    signals.push({
      signal_type: "review_spike",
      confidence_score: 62,
      source_type: "review_site",
      source_url: input.domain ? `https://${input.domain}` : null,
      evidence_excerpt: `High review count (${input.review_count}) in discovery metadata`,
    })
  }

  if (input.rating != null && input.rating <= 3.2) {
    signals.push({
      signal_type: "negative_review_spike",
      confidence_score: 58,
      source_type: "review_site",
      source_url: input.domain ? `https://${input.domain}` : null,
      evidence_excerpt: `Low rating (${input.rating}) in discovery metadata`,
    })
  }

  if ((input.review_count ?? 0) === 0 && input.domain) {
    signals.push({
      signal_type: "stale_data",
      confidence_score: 45,
      source_type: "review_site",
      source_url: `https://${input.domain}`,
      evidence_excerpt: "No review presence in available discovery metadata",
      metadata: { theme: "no_review_presence" },
    })
  }

  return { provider: "stub", evidence, signals }
}
