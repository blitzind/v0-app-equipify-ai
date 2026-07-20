/** GE-AIOS-NEXT-1C — Client-safe strategic evaluation context from existing Home read models. */

import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import type { OrganizationalKnowledgeItem } from "@/lib/growth/memory/knowledge/organization-knowledge-types"
import type { AvaOrganizationalPreference } from "@/lib/growth/memory/types"
import type { GrowthHomeAvaStrategicEvaluationContext } from "@/lib/growth/ava-home/recommendations/growth-home-ava-strategic-advisor-next-1c"
import type { GrowthHomeAvaStrategicOverrideRecord } from "@/lib/growth/ava-home/recommendations/growth-home-ava-strategic-override-memory-next-1c"

export const GROWTH_AIOS_NEXT_1C_STRATEGIC_CONTEXT_QA_MARKER =
  "ge-aios-next-1c-ava-strategic-context-v1" as const

export type GrowthHomeAvaStrategicAdvisorContextPayload = {
  qaMarker: typeof GROWTH_AIOS_NEXT_1C_STRATEGIC_CONTEXT_QA_MARKER
  approvedProfile: BusinessProfileDraftContent | null
  organizationalKnowledge: OrganizationalKnowledgeItem[]
  organizationPreferences: AvaOrganizationalPreference[]
}

export function buildGrowthHomeAvaStrategicAdvisorContextPayload(input: {
  approvedProfile?: BusinessProfileDraftContent | null
  organizationalKnowledge?: OrganizationalKnowledgeItem[]
  organizationPreferences?: AvaOrganizationalPreference[]
}): GrowthHomeAvaStrategicAdvisorContextPayload {
  return {
    qaMarker: GROWTH_AIOS_NEXT_1C_STRATEGIC_CONTEXT_QA_MARKER,
    approvedProfile: input.approvedProfile ?? null,
    organizationalKnowledge: input.organizationalKnowledge ?? [],
    organizationPreferences: input.organizationPreferences ?? [],
  }
}

export function buildGrowthHomeAvaStrategicEvaluationContext(input: {
  payload?: GrowthHomeAvaStrategicAdvisorContextPayload | null
  overrideRecords?: GrowthHomeAvaStrategicOverrideRecord[]
}): GrowthHomeAvaStrategicEvaluationContext {
  const profile = input.payload?.approvedProfile ?? null
  const canonical = profile?.canonicalSellerKnowledge?.company ?? null

  return {
    approvedProfile: profile,
    organizationalKnowledge: input.payload?.organizationalKnowledge ?? [],
    organizationPreferences: input.payload?.organizationPreferences ?? [],
    sellerTargetCustomer: canonical?.targetCustomer ?? null,
    sellerPoorFitCustomer: canonical?.poorFitCustomer ?? null,
    sellerWhenNotToRecommend: canonical?.whenNotToRecommend ?? [],
    overrideRecords: input.overrideRecords ?? [],
  }
}
