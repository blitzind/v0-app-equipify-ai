/** AIOS-TRAINING-KNOWLEDGE-INTEGRATION-1B — Organization context for prospect research prompts (client-safe). */

import type { GrowthOutreachSellerTruth } from "@/lib/growth/aios/growth/growth-outreach-seller-truth"

export const AIOS_TRAINING_KNOWLEDGE_INTEGRATION_1B_QA_MARKER =
  "aios-training-knowledge-integration-1b-v1" as const

/** Neutral AI JSON key — mapped to legacy `equipify_fit_score` at parse boundary. */
export const GROWTH_PROSPECT_RESEARCH_AI_FIT_SCORE_KEY = "organization_fit_score" as const

/** Persisted/API legacy key retained for backward compatibility. */
export const GROWTH_PROSPECT_RESEARCH_LEGACY_FIT_SCORE_KEY = "equipify_fit_score" as const

/** Neutral AI JSON key — mapped to legacy `equipify_pain_points` at parse boundary. */
export const GROWTH_PROSPECT_RESEARCH_AI_PAIN_POINTS_KEY = "organization_pain_points" as const

/** Persisted/API legacy key retained for backward compatibility. */
export const GROWTH_PROSPECT_RESEARCH_LEGACY_PAIN_POINTS_KEY = "equipify_pain_points" as const

export type GrowthProspectResearchOrganizationContext = {
  source: GrowthOutreachSellerTruth["source"]
  companyName: string | null
  productsServices: string[]
  mission: string | null
  elevatorPitch: string | null
  primaryValueProposition: string | null
  targetIndustries: string[]
  geography: string[]
  companySizeRanges: string[]
  qualificationStandards: string[]
  disqualifiers: string[]
  competitiveAdvantages: string[]
  operationalProblemsSolved: string[]
  pricingPhilosophy: string | null
}

export function buildGrowthProspectResearchOrganizationContextFallback(): GrowthProspectResearchOrganizationContext {
  return {
    source: "fallback_defaults",
    companyName: null,
    productsServices: [],
    mission: null,
    elevatorPitch: null,
    primaryValueProposition: null,
    targetIndustries: [],
    geography: [],
    companySizeRanges: [],
    qualificationStandards: [],
    disqualifiers: [],
    competitiveAdvantages: [],
    operationalProblemsSolved: [],
    pricingPhilosophy: null,
  }
}

export function buildGrowthProspectResearchOrganizationContextFromSellerTruth(input: {
  sellerTruth: GrowthOutreachSellerTruth
  geography?: string[]
  companySizeRanges?: string[]
  painPoints?: string[]
}): GrowthProspectResearchOrganizationContext {
  const pricingPhilosophy =
    input.sellerTruth.commercialGuidance?.find((entry) => entry.trim()) ??
    input.sellerTruth.enrichments.fromBusinessIntelligence.find((entry) =>
      /pricing|commercial|budget/i.test(entry),
    ) ??
    null

  return {
    source: input.sellerTruth.source,
    companyName: input.sellerTruth.sellerCompanyName,
    productsServices: input.sellerTruth.productsServices,
    mission: input.sellerTruth.mission,
    elevatorPitch: input.sellerTruth.elevatorPitch,
    primaryValueProposition: input.sellerTruth.primaryValueProposition,
    targetIndustries: input.sellerTruth.industries,
    geography: input.geography ?? [],
    companySizeRanges: input.companySizeRanges ?? [],
    qualificationStandards: input.sellerTruth.salesPhilosophy,
    disqualifiers: input.sellerTruth.disqualifiers,
    competitiveAdvantages: input.sellerTruth.differentiators,
    operationalProblemsSolved: uniqueStrings([
      ...input.painPoints ?? [],
      ...input.sellerTruth.businessOutcomes,
    ]),
    pricingPhilosophy,
  }
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}
