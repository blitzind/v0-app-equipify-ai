/** GE-AIOS-DATAMOON-AUTONOMOUS-DISCOVERY-CUTOVER-1A — Business Profile → DataMoon request projection (client-safe). */

import { buildDatamoonImportRequestFromAudienceDraft } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-draft-builder"
import { buildAudienceDraftFromLeadDiscoveryProjection } from "@/lib/growth/ava-home/datamoon/ava-datamoon-lead-discovery-defaults"
import { projectApprovedBusinessProfileToLeadDiscovery } from "@/lib/growth/business-profile/business-profile-lead-discovery-projection"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import type { DatamoonAudienceImportRequest } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import {
  AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX,
  GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"

export type DatamoonAutonomousDiscoveryRequestProjection = {
  qaMarker: typeof GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER
  request: DatamoonAudienceImportRequest
  fingerprint: string
  targetingSummary: {
    industryCount: number
    keywordCount: number
    naicsCount: number
    excludedNaicsCount: number
    geographyPresent: boolean
    buyerPersonaCount: number
    negativeKeywordCount: number
    equipmentServiceFocus: boolean
  }
}

function hashFingerprint(parts: string[]): string {
  let hash = 0
  for (const part of parts) {
    for (let i = 0; i < part.length; i += 1) {
      hash = (hash * 31 + part.charCodeAt(i)) >>> 0
    }
  }
  return hash.toString(16).padStart(8, "0")
}

function equipmentServiceFocus(profile: BusinessProfileDraftContent): boolean {
  const corpus = [
    ...profile.idealCustomers.targetIndustries,
    ...profile.problemsAndTriggers.keywords,
    profile.company.shortDescription,
    profile.company.primaryValueProposition,
  ]
    .join(" ")
    .toLowerCase()
  return /equipment|maintenance|service|biomedical|field service|repair/.test(corpus)
}

export function buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile(input: {
  profile: BusinessProfileDraftContent
  companyName?: string | null
  organizationId: string
  batchSize: number
  generatedAt: string
}): DatamoonAutonomousDiscoveryRequestProjection {
  const projection = projectApprovedBusinessProfileToLeadDiscovery(
    input.profile,
    input.companyName,
  )
  const draft = buildAudienceDraftFromLeadDiscoveryProjection(projection, {
    audienceName: projection.audienceNameSuggestion,
    recordLimit: Math.max(1, Math.min(100, Math.floor(input.batchSize))),
    excludeDuplicates: true,
  })

  const request = buildDatamoonImportRequestFromAudienceDraft(draft)
  request.run_name = `${AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX}:${input.generatedAt.slice(0, 10)}`
  request.limit = Math.max(1, Math.min(100, Math.floor(input.batchSize)))

  const fingerprint = hashFingerprint([
    input.organizationId,
    projection.industries.join("|"),
    projection.keywords.join("|"),
    projection.geography.state ?? projection.geography.country,
    (input.profile.idealCustomers.preferredNaicsCodes ?? []).join("|"),
    (input.profile.idealCustomers.excludedNaicsCodes ?? []).join("|"),
    projection.buyerPersonas.join("|"),
    projection.negativeKeywords.join("|"),
  ])

  return {
    qaMarker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
    request,
    fingerprint,
    targetingSummary: {
      industryCount: projection.industries.length,
      keywordCount: projection.keywords.length,
      naicsCount: input.profile.idealCustomers.preferredNaicsCodes?.length ?? 0,
      excludedNaicsCount: input.profile.idealCustomers.excludedNaicsCodes?.length ?? 0,
      geographyPresent: Boolean(projection.geography.country || projection.geography.state),
      buyerPersonaCount: projection.buyerPersonas.length,
      negativeKeywordCount: projection.negativeKeywords.length,
      equipmentServiceFocus: equipmentServiceFocus(input.profile),
    },
  }
}
