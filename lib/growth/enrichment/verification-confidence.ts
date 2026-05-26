import type {
  GrowthEnrichmentAttributionTier,
  GrowthVerificationChannelStatus,
} from "@/lib/growth/enrichment/enrichment-types"

const CHANNEL_WEIGHT: Record<GrowthVerificationChannelStatus, number> = {
  operator_verified: 0.35,
  observed: 0.28,
  unverified: 0.08,
  not_present: 0,
  insufficient_evidence: 0,
  rejected: -0.15,
}

const TIER_BOOST: Record<GrowthEnrichmentAttributionTier, number> = {
  observed: 0.12,
  provider: 0.06,
  inferred: 0,
}

export function scoreContactVerificationConfidence(input: {
  email_status: GrowthVerificationChannelStatus
  phone_status: GrowthVerificationChannelStatus
  linkedin_status: GrowthVerificationChannelStatus
  evidence_count: number
  top_tier: GrowthEnrichmentAttributionTier
}): number {
  let score = 0.25
  score += CHANNEL_WEIGHT[input.email_status] ?? 0
  score += CHANNEL_WEIGHT[input.phone_status] ?? 0
  score += CHANNEL_WEIGHT[input.linkedin_status] ?? 0
  score += Math.min(0.15, input.evidence_count * 0.04)
  score += TIER_BOOST[input.top_tier] ?? 0
  return Number(Math.min(0.99, Math.max(0, score)).toFixed(3))
}

export function scoreCompanyEnrichmentConfidence(input: {
  signal_count: number
  top_tier: GrowthEnrichmentAttributionTier
  has_industry: boolean
}): number {
  let score = 0.3
  score += Math.min(0.35, input.signal_count * 0.06)
  score += TIER_BOOST[input.top_tier] ?? 0
  if (input.has_industry) score += 0.08
  return Number(Math.min(0.99, Math.max(0, score)).toFixed(3))
}

export function topAttributionTier(
  tiers: GrowthEnrichmentAttributionTier[],
): GrowthEnrichmentAttributionTier {
  if (tiers.includes("observed")) return "observed"
  if (tiers.includes("provider")) return "provider"
  return "inferred"
}

export function channelStatusLabel(status: GrowthVerificationChannelStatus): string {
  switch (status) {
    case "observed":
      return "Observed"
    case "operator_verified":
      return "Verified"
    case "not_present":
      return "Not present"
    case "insufficient_evidence":
      return "Insufficient evidence"
    case "rejected":
      return "Rejected"
    default:
      return "Unverified"
  }
}
