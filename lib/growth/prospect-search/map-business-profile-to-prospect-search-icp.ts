/** GE-AIOS-18D — Approved Growth Profile → Prospect Search ICP (client-safe). */

import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import {
  EQUIPIFY_DEFAULT_AI_ICP_PROFILE,
  type ProspectSearchAiIcpProfile,
} from "@/lib/growth/prospect-search/prospect-search-ai-icp-config"

export const GROWTH_PROSPECT_SEARCH_BUSINESS_PROFILE_ICP_18D_QA_MARKER =
  "ge-aios-18d-prospect-search-business-profile-icp-v1" as const

export function mapBusinessProfileContentToProspectSearchIcp(
  content: BusinessProfileDraftContent,
  companyName?: string | null,
): ProspectSearchAiIcpProfile {
  const label = companyName?.trim() || content.company.companyName?.trim() || "Your company"
  const companySize =
    content.idealCustomers.companySizeRanges.join(", ").trim() ||
    EQUIPIFY_DEFAULT_AI_ICP_PROFILE.companySize
  const geography =
    content.idealCustomers.geography.join(", ").trim() || EQUIPIFY_DEFAULT_AI_ICP_PROFILE.geography

  return {
    companyLabel: label,
    whatWeSell:
      content.company.primaryValueProposition?.trim() ||
      content.company.productsServices.join("; ").trim() ||
      content.company.shortDescription?.trim() ||
      EQUIPIFY_DEFAULT_AI_ICP_PROFILE.whatWeSell,
    customerTypes:
      content.idealCustomers.buyerPersonas.length > 0
        ? content.idealCustomers.buyerPersonas
        : content.idealCustomers.targetIndustries,
    industries:
      content.idealCustomers.targetIndustries.length > 0
        ? content.idealCustomers.targetIndustries
        : EQUIPIFY_DEFAULT_AI_ICP_PROFILE.industries,
    workflows: content.problemsAndTriggers.painPoints.slice(0, 6),
    decisionMakers:
      content.idealCustomers.buyerPersonas.length > 0
        ? content.idealCustomers.buyerPersonas
        : EQUIPIFY_DEFAULT_AI_ICP_PROFILE.decisionMakers,
    buyingSignals: content.problemsAndTriggers.buyingTriggers.slice(0, 6),
    geography,
    companySize,
    disqualifiers:
      content.idealCustomers.disqualifiers.length > 0
        ? content.idealCustomers.disqualifiers
        : EQUIPIFY_DEFAULT_AI_ICP_PROFILE.disqualifiers,
    buyingTriggers: content.problemsAndTriggers.buyingTriggers.slice(0, 6),
  }
}

export function resolveProspectSearchAiIcpProfile(input: {
  approvedProfileContent?: BusinessProfileDraftContent | null
  companyName?: string | null
  storedDraft?: ProspectSearchAiIcpProfile | null
}): ProspectSearchAiIcpProfile {
  if (input.approvedProfileContent) {
    return mapBusinessProfileContentToProspectSearchIcp(input.approvedProfileContent, input.companyName)
  }
  if (input.storedDraft) return input.storedDraft
  return EQUIPIFY_DEFAULT_AI_ICP_PROFILE
}
