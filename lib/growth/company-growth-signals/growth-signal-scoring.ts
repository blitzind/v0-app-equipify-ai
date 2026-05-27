/** Deterministic growth signal scoring engine. Client-safe. */

import type {
  GrowthCompanyGrowthSignal,
  GrowthCompanyGrowthSignalScore,
  GrowthCompanyGrowthSignalType,
  GrowthSignalTier,
  RawGrowthSignalCandidate,
} from "@/lib/growth/company-growth-signals/company-growth-signal-types"

const SIGNAL_WEIGHTS: Partial<Record<GrowthCompanyGrowthSignalType, number>> = {
  hiring_technicians: 18,
  hiring_operations: 16,
  competitor_detected: 15,
  buying_intent: 14,
  technology_change: 12,
  expansion: 12,
  funding_or_acquisition: 14,
  service_line_expansion: 10,
  review_spike: 8,
  negative_review_spike: 6,
  new_location: 10,
  website_rebuild: 8,
  equipment_specialty_detected: 8,
  stale_data: -8,
}

function tierFromScore(score: number): GrowthSignalTier {
  if (score >= 80) return "urgent"
  if (score >= 60) return "high"
  if (score >= 35) return "moderate"
  return "low"
}

function recommendNextAction(signals: RawGrowthSignalCandidate[]): string {
  const types = new Set(signals.map((signal) => signal.signal_type))
  if (types.has("hiring_technicians") || types.has("hiring_operations")) {
    return "Research hiring contacts and validate operational pain"
  }
  if (types.has("competitor_detected")) {
    return "Validate incumbent vendor and position upgrade opportunity"
  }
  if (types.has("buying_intent") || types.has("technology_change")) {
    return "Review technology stack and schedule discovery call"
  }
  if (types.has("expansion") || types.has("new_location")) {
    return "Confirm expansion timeline and service footprint"
  }
  if (types.has("negative_review_spike")) {
    return "Explore service quality pain in first conversation"
  }
  return "Review top growth signals before outreach"
}

export function computeGrowthSignalScore(input: {
  signals: RawGrowthSignalCandidate[] | GrowthCompanyGrowthSignal[]
  contact_coverage_score?: number | null
  website_maturity_score?: number | null
  icp_fit_score?: number | null
}): GrowthCompanyGrowthSignalScore {
  const active = input.signals.filter((signal) => {
    if ("expires_at" in signal && signal.expires_at && Date.parse(signal.expires_at) <= Date.now()) return false
    return signal.evidence_excerpt.trim().length > 0
  })

  let score = 0
  for (const signal of active) {
    const weight = SIGNAL_WEIGHTS[signal.signal_type] ?? 5
    score += Math.round((weight * signal.confidence_score) / 100)
  }

  if (input.contact_coverage_score != null) score += Math.round(input.contact_coverage_score * 0.15)
  if (input.website_maturity_score != null) score += Math.round(input.website_maturity_score * 0.1)
  if (input.icp_fit_score != null) score += Math.round(input.icp_fit_score * 0.1)

  score = Math.max(0, Math.min(100, score))

  const top_signals = [...active]
    .sort((a, b) => b.confidence_score - a.confidence_score)
    .slice(0, 5)
    .map((signal) => ({
      signal_type: signal.signal_type,
      confidence_score: signal.confidence_score,
      evidence_excerpt: signal.evidence_excerpt,
    }))

  return {
    company_id: "",
    growth_signal_score: score,
    signal_tier: tierFromScore(score),
    top_signals,
    recommended_next_action: active.length > 0 ? recommendNextAction(active) : null,
    last_computed_at: new Date().toISOString(),
  }
}

export function growthSignalRankBoost(score: number | null | undefined): number {
  if (score == null) return 0
  if (score >= 80) return 0.04
  if (score >= 60) return 0.03
  if (score >= 35) return 0.015
  return 0
}
