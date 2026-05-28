/** Progressive enrichment tiers — compute follows contactability and operator intent. Client-safe. */

import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import {
  hasProspectSearchReachableHumans,
  resolveProspectSearchReachableHumanScore,
  type ProspectSearchReachableHumanSnapshot,
} from "@/lib/growth/prospect-search/prospect-search-reachable-human-scoring"

export const GROWTH_PROGRESSIVE_ENRICHMENT_QA_MARKER = "growth-progressive-enrichment-v1" as const
export const GROWTH_CONTACT_FIRST_DISCOVERY_QA_MARKER = "growth-contact-first-discovery-v1" as const

export const PROSPECT_SEARCH_ENRICHMENT_TIERS = [
  "tier_1_lightweight_discovery",
  "tier_2_contact_acquisition",
  "tier_3_contact_intelligence",
  "tier_4_deep_revenue_intelligence",
] as const

export type ProspectSearchEnrichmentTier = (typeof PROSPECT_SEARCH_ENRICHMENT_TIERS)[number]

export type ProspectSearchProgressiveEnrichmentContext = {
  tier: ProspectSearchEnrichmentTier
  operator_selected?: boolean
  operator_queued?: boolean
  operator_viewed?: boolean
  bulk_action?: boolean
  force_deep?: boolean
}

export type ProspectSearchProgressiveEnrichmentPlan = {
  qa_marker: typeof GROWTH_PROGRESSIVE_ENRICHMENT_QA_MARKER
  contact_first_qa_marker: typeof GROWTH_CONTACT_FIRST_DISCOVERY_QA_MARKER
  max_tier: ProspectSearchEnrichmentTier
  skip_market_overlays: boolean
  skip_signal_overlays: boolean
  skip_committee_modeling: boolean
  skip_opportunity_emergence: boolean
  skip_territory_expansion: boolean
  skip_relationship_progression: boolean
  reasons: string[]
}

const TIER_ORDER: Record<ProspectSearchEnrichmentTier, number> = {
  tier_1_lightweight_discovery: 1,
  tier_2_contact_acquisition: 2,
  tier_3_contact_intelligence: 3,
  tier_4_deep_revenue_intelligence: 4,
}

export function compareProspectSearchEnrichmentTiers(
  a: ProspectSearchEnrichmentTier,
  b: ProspectSearchEnrichmentTier,
): number {
  return TIER_ORDER[a] - TIER_ORDER[b]
}

export function resolveProspectSearchProgressiveEnrichmentPlan(input: {
  company: GrowthProspectSearchCompanyResult
  context?: ProspectSearchProgressiveEnrichmentContext
  reachable?: ProspectSearchReachableHumanSnapshot
}): ProspectSearchProgressiveEnrichmentPlan {
  const reachable = input.reachable ?? resolveProspectSearchReachableHumanScore(input.company)
  const ctx = input.context ?? { tier: "tier_1_lightweight_discovery" }
  const reasons: string[] = []

  let max_tier: ProspectSearchEnrichmentTier = "tier_1_lightweight_discovery"

  if (ctx.force_deep) {
    max_tier = "tier_4_deep_revenue_intelligence"
    reasons.push("Operator requested deep enrichment")
  } else if (ctx.operator_selected || ctx.operator_queued || ctx.bulk_action) {
    max_tier = hasProspectSearchReachableHumans(reachable)
      ? "tier_3_contact_intelligence"
      : "tier_2_contact_acquisition"
    reasons.push("Operator intent triggers contact acquisition or intelligence")
  } else if (ctx.operator_viewed) {
    max_tier = hasProspectSearchReachableHumans(reachable)
      ? "tier_3_contact_intelligence"
      : "tier_2_contact_acquisition"
    reasons.push("Account viewed — progressive contact hydration")
  } else if (hasProspectSearchReachableHumans(reachable)) {
    max_tier =
      reachable.label === "outreach_ready" ? "tier_3_contact_intelligence" : "tier_2_contact_acquisition"
    reasons.push(`Reachable human label: ${reachable.label}`)
  } else {
    max_tier = "tier_1_lightweight_discovery"
    reasons.push("No reachable humans — defer expensive enrichment")
  }

  if (compareProspectSearchEnrichmentTiers(ctx.tier, max_tier) > 0) {
    max_tier = ctx.tier
    reasons.push(`Context tier raised ceiling to ${ctx.tier}`)
  }

  const deepAllowed = compareProspectSearchEnrichmentTiers(max_tier, "tier_4_deep_revenue_intelligence") >= 0
  const intelligenceAllowed =
    compareProspectSearchEnrichmentTiers(max_tier, "tier_3_contact_intelligence") >= 0

  return {
    qa_marker: GROWTH_PROGRESSIVE_ENRICHMENT_QA_MARKER,
    contact_first_qa_marker: GROWTH_CONTACT_FIRST_DISCOVERY_QA_MARKER,
    max_tier,
    skip_market_overlays: !deepAllowed && !intelligenceAllowed,
    skip_signal_overlays: !deepAllowed,
    skip_committee_modeling: !deepAllowed,
    skip_opportunity_emergence: !deepAllowed,
    skip_territory_expansion: !deepAllowed,
    skip_relationship_progression: !deepAllowed,
    reasons,
  }
}

export function shouldRunProspectSearchDeepOverlays(
  plan: ProspectSearchProgressiveEnrichmentPlan,
): boolean {
  return !plan.skip_market_overlays
}
