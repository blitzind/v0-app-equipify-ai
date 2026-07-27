/** GE-AIOS-DATAMOON-AUTONOMOUS-DISCOVERY-CUTOVER-1A — Business Profile → DataMoon request projection (client-safe). */

import { buildDatamoonImportRequestFromAudienceDraft } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-draft-builder"
import { buildAudienceDraftFromLeadDiscoveryProjection } from "@/lib/growth/ava-home/datamoon/ava-datamoon-lead-discovery-defaults"
import { projectApprovedBusinessProfileToLeadDiscovery } from "@/lib/growth/business-profile/business-profile-lead-discovery-projection"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import type { DatamoonAudienceImportRequest } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import {
  buildDatamoonFirmographicFilterStrategyMetadata,
  type DatamoonFirmographicFilterStrategyMetadata,
} from "@/lib/growth/lead-sources/datamoon/datamoon-firmographic-filter-mapping-1a"
import {
  buildDatamoonOperationalTargetingStrategyMetadata,
  translateDatamoonOperationalModelTargeting,
  type DatamoonOperationalTargetingStrategyMetadata,
} from "@/lib/growth/lead-sources/datamoon/datamoon-operational-model-targeting-1a"
import type { DatamoonDiscoverySearchSliceSelection } from "@/lib/growth/lead-sources/datamoon/growth-datamoon-discovery-search-slice-1a-types"
import type { DatamoonAudienceFilter } from "@/lib/growth/providers/datamoon"
import {
  GROWTH_DATAMOON_AUTONOMOUS_BROAD_PROVIDER_DISCOVERY_1A_QA_MARKER,
} from "@/lib/growth/lead-sources/datamoon/datamoon-autonomous-broad-provider-discovery-1a"
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
    supportedServiceVerticalCount?: number
    targetingStrategy?: DatamoonOperationalTargetingStrategyMetadata
    firmographicStrategy?: DatamoonFirmographicFilterStrategyMetadata
    discoverySearchSlice?: Pick<
      DatamoonDiscoverySearchSliceSelection,
      | "sliceKey"
      | "clusterId"
      | "geoBucketId"
      | "geoBucketLabel"
      | "topicVariantIndex"
      | "selectionReason"
    > | null
  }
}

function applyDiscoveryGeoBucketFilters(
  filters: DatamoonAudienceFilter[],
  searchSlice?: DatamoonDiscoverySearchSliceSelection | null,
): DatamoonAudienceFilter[] {
  if (!searchSlice?.stateCodes.length) return filters

  const withoutGeo = filters.filter(
    (row) =>
      row.field !== "state" &&
      row.field !== "personal_state" &&
      row.field !== "country" &&
      row.field !== "contact_country" &&
      row.field !== "city" &&
      row.field !== "personal_city",
  )

  // Slice geo buckets drive rotation/exhaustion only — provider query stays US-wide so
  // DataMoon can return candidates; GPT-5.5 admission evaluates ICP fit downstream.
  return [{ field: "country", operator: "=", value: "United States" }, ...withoutGeo]
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
  audienceOrdinal?: number
  searchSlice?: DatamoonDiscoverySearchSliceSelection | null
}): DatamoonAutonomousDiscoveryRequestProjection {
  const projection = projectApprovedBusinessProfileToLeadDiscovery(
    input.profile,
    input.companyName,
  )
  const searchSlice = input.searchSlice ?? null
  const operationalTargeting = translateDatamoonOperationalModelTargeting({
    projection,
    organizationId: input.organizationId,
    audienceOrdinal: input.audienceOrdinal ?? 0,
    clusterRotationIndex: searchSlice?.clusterRotationIndex,
    topicVariantIndex: searchSlice?.topicVariantIndex ?? 0,
    preferClusterBroadeningAnchors: Boolean(searchSlice),
  })
  const targetingStrategy = buildDatamoonOperationalTargetingStrategyMetadata(operationalTargeting)
  const firmographicStrategy = buildDatamoonFirmographicFilterStrategyMetadata({
    projection,
    operationalTargeting,
    companySizeRanges: input.profile.idealCustomers.companySizeRanges,
  })

  const draft = buildAudienceDraftFromLeadDiscoveryProjection(projection, {
    audienceName: projection.audienceNameSuggestion,
    recordLimit: Math.max(1, Math.min(100, Math.floor(input.batchSize))),
    excludeDuplicates: true,
    // Qualification topics/personas stay in workbench metadata — not provider B2B filters.
    topics: [],
    jobTitles: [],
    intentLevels: [],
    lookbackDays: 0,
  })

  const request = buildDatamoonImportRequestFromAudienceDraft(draft)
  request.audience_type = "advanced_search"
  request.filters = applyDiscoveryGeoBucketFilters([], searchSlice)
  request.run_name = `${AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX}:${input.generatedAt.slice(0, 10)}`
  request.limit = Math.max(1, Math.min(100, Math.floor(input.batchSize)))
  request.workbench_context = {
    ...(request.workbench_context ?? {}),
    topics: [],
    intentLevels: [],
    lookbackDays: 0,
    autonomousBroadProviderDiscovery: true,
    qaMarker: GROWTH_DATAMOON_AUTONOMOUS_BROAD_PROVIDER_DISCOVERY_1A_QA_MARKER,
    discoveryQualificationContext: {
      topicPhrases: operationalTargeting.topicPhrases,
      supplementalTopicSearchQueries: operationalTargeting.industryAliasesUsed,
      clusterBroadeningAnchors: operationalTargeting.clusterBroadeningAnchors,
      operationalConceptPhrases: operationalTargeting.operationalConcepts,
      discoverySearchSlice: searchSlice
        ? {
            sliceKey: searchSlice.sliceKey,
            clusterId: searchSlice.clusterId,
            geoBucketId: searchSlice.geoBucketId,
            geoBucketLabel: searchSlice.geoBucketLabel,
            topicVariantIndex: searchSlice.topicVariantIndex,
            selectionReason: searchSlice.selectionReason,
          }
        : null,
    },
    topicRankingSignals: {
      topicPhrases: operationalTargeting.topicPhrases,
      operationalConceptPhrases: operationalTargeting.operationalConcepts,
      qualificationTopicPhrases: operationalTargeting.qualificationTopics,
      supplementalAliases: operationalTargeting.industryAliasesUsed,
      clusterBroadeningAnchors: operationalTargeting.clusterBroadeningAnchors,
    },
    ...(searchSlice
      ? {
          discoverySearchSlice: {
            sliceKey: searchSlice.sliceKey,
            clusterId: searchSlice.clusterId,
            geoBucketId: searchSlice.geoBucketId,
            geoBucketLabel: searchSlice.geoBucketLabel,
            topicVariantIndex: searchSlice.topicVariantIndex,
            selectionReason: searchSlice.selectionReason,
          },
        }
      : {}),
  }

  const fingerprint = hashFingerprint([
    input.organizationId,
    String(input.audienceOrdinal ?? 0),
    searchSlice?.sliceKey ?? "no-slice",
    String(searchSlice?.topicVariantIndex ?? 0),
    operationalTargeting.operationalCluster,
    operationalTargeting.selectedVerticalIds.join("|"),
    operationalTargeting.topicPhrases.join("|"),
    operationalTargeting.industryAliasesUsed.join("|"),
    projection.qualificationCriteria.join("|"),
    projection.industries.join("|"),
    projection.keywords.join("|"),
    projection.geography.state ?? projection.geography.country,
    (input.profile.idealCustomers.preferredNaicsCodes ?? []).join("|"),
    (input.profile.idealCustomers.excludedNaicsCodes ?? []).join("|"),
    projection.buyerPersonas.join("|"),
    projection.negativeKeywords.join("|"),
    firmographicStrategy.primaryIndustryValues.join("|"),
    firmographicStrategy.companyEmployeeCountBands.join("|"),
    firmographicStrategy.companyRevenueBands.join("|"),
  ])

  return {
    qaMarker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
    request,
    fingerprint,
    targetingSummary: {
      industryCount: projection.industries.length,
      supportedServiceVerticalCount: projection.supportedServiceVerticals.length,
      keywordCount: projection.keywords.length,
      naicsCount: input.profile.idealCustomers.preferredNaicsCodes?.length ?? 0,
      excludedNaicsCount: input.profile.idealCustomers.excludedNaicsCodes?.length ?? 0,
      geographyPresent: Boolean(projection.geography.country || projection.geography.state),
      buyerPersonaCount: projection.buyerPersonas.length,
      negativeKeywordCount: projection.negativeKeywords.length,
      equipmentServiceFocus: equipmentServiceFocus(input.profile),
      targetingStrategy,
      firmographicStrategy,
      discoverySearchSlice: searchSlice
        ? {
            sliceKey: searchSlice.sliceKey,
            clusterId: searchSlice.clusterId,
            geoBucketId: searchSlice.geoBucketId,
            geoBucketLabel: searchSlice.geoBucketLabel,
            topicVariantIndex: searchSlice.topicVariantIndex,
            selectionReason: searchSlice.selectionReason,
          }
        : null,
    },
  }
}
