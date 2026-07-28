/** AVA-DISCOVERY-BROAD-PROVIDER-GPT-QUALIFICATION-CUTOVER-1A — Broad DataMoon sourcing for autonomous portfolio (client-safe). */

import type { DatamoonAudienceImportRequest } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import {
  GROWTH_DATAMOON_AUTONOMOUS_BROAD_SEARCH_SIGNAL_1A_QA_MARKER,
  type AutonomousBroadDiscoveryConcept,
  type AutonomousBroadDiscoveryObservability,
} from "@/lib/growth/lead-sources/datamoon/datamoon-autonomous-broad-search-signal-1a"
import {
  mapDatamoonFiltersToProviderFilters,
  type DatamoonAudienceImportWorkbenchContext,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-filter-mapping"
import type { DatamoonAudienceFilter } from "@/lib/growth/providers/datamoon"

export const GROWTH_DATAMOON_AUTONOMOUS_BROAD_PROVIDER_DISCOVERY_1A_QA_MARKER =
  "ava-discovery-broad-provider-gpt-qualification-cutover-1a-v1" as const

export const AUTONOMOUS_BROAD_PROVIDER_QUALIFICATION_FILTER_FIELDS = [
  "state",
  "personal_state",
  "city",
  "personal_city",
  "score_category",
  "event_date",
  "job_title",
  "primary_industry",
  "company_employee_count",
  "company_revenue",
] as const

export type AutonomousBroadProviderDiscoveryQualificationContext = {
  topicPhrases: string[]
  supplementalTopicSearchQueries?: string[]
  clusterBroadeningAnchors?: string[]
  operationalConceptPhrases?: string[]
  discoverySearchSlice?: Record<string, unknown> | null
}

export type AutonomousBroadProviderDiscoveryWorkbenchContext = DatamoonAudienceImportWorkbenchContext & {
  qaMarker?: typeof GROWTH_DATAMOON_AUTONOMOUS_BROAD_PROVIDER_DISCOVERY_1A_QA_MARKER
  autonomousBroadProviderDiscovery?: boolean
  autonomousBroadSearchSignal?: boolean
  qualificationFiltersDeferred?: boolean
  providerDiscoveryConcept?: string
  providerDiscoveryConceptSource?: AutonomousBroadDiscoveryConcept["conceptSource"]
  broadDiscoveryObservability?: AutonomousBroadDiscoveryObservability
  discoveryQualificationContext?: AutonomousBroadProviderDiscoveryQualificationContext
  deferredProviderQualificationFields?: string[]
}

export function isAutonomousBroadProviderDiscoveryRequest(input: {
  workbench_context?: AutonomousBroadProviderDiscoveryWorkbenchContext | null
}): boolean {
  return input.workbench_context?.autonomousBroadProviderDiscovery === true
}

/** Provider-side filters deferred to GPT-5.5 admission for autonomous portfolio discovery. */
export function stripAutonomousBroadProviderQualificationFilters(
  filters: readonly DatamoonAudienceFilter[],
): DatamoonAudienceFilter[] {
  const deferred = new Set<string>(AUTONOMOUS_BROAD_PROVIDER_QUALIFICATION_FILTER_FIELDS)
  return filters.filter((row) => !deferred.has(row.field))
}

/** Minimal broad-sourcing filters: United States only. */
export function buildAutonomousBroadProviderDiscoveryFilters(): DatamoonAudienceFilter[] {
  return [{ field: "country", operator: "=", value: "United States" }]
}

/** Strip qualification gates; keep US-wide geography and one provider discovery topic phrase. */
export function stripAutonomousBroadProviderQualificationFromRequest(
  input: DatamoonAudienceImportRequest,
): DatamoonAudienceImportRequest {
  const broadFilters = buildAutonomousBroadProviderDiscoveryFilters()
  const mapped = mapDatamoonFiltersToProviderFilters(broadFilters)
  const priorFilters = input.filters ?? []
  const deferredFields = [
    ...new Set([
      ...priorFilters.map((row) => row.field),
      ...(input.workbench_context?.intentLevels ?? []).length > 0 ? ["intent_levels"] : [],
      ...(input.workbench_context?.lookbackDays != null && input.workbench_context.lookbackDays > 0
        ? ["lookback_days"]
        : []),
    ]),
  ]
  const discoveryTopics =
    input.workbench_context?.topics?.map((row) => row.trim()).filter((row) => row.length >= 3) ?? []

  return {
    ...input,
    topic_ids: undefined,
    filters: mapped.providerFilters,
    workbench_context: {
      ...(input.workbench_context ?? {}),
      topics: discoveryTopics.slice(0, 1),
      intentLevels: [],
      lookbackDays: 0,
      supplementalTopicSearchQueries: undefined,
      autonomousBroadProviderDiscovery: true,
      autonomousBroadSearchSignal: discoveryTopics.length > 0,
      qualificationFiltersDeferred: true,
      qaMarker: GROWTH_DATAMOON_AUTONOMOUS_BROAD_PROVIDER_DISCOVERY_1A_QA_MARKER,
      deferredProviderQualificationFields: deferredFields,
      omittedWorkbenchFilterFields: [
        ...new Set([
          ...(input.workbench_context?.omittedWorkbenchFilterFields ?? []),
          ...mapped.omittedWorkbenchFilterFields,
          "lookback_days",
          "intent_level",
          "topic",
          "job_title",
          "score_category",
          "event_date",
          "personal_state",
          "state",
          "primary_industry",
        ]),
      ],
    },
  }
}

/** @deprecated Use stripAutonomousBroadProviderQualificationFromRequest + broad search signal prepare. */
export function prepareAutonomousBroadProviderDiscoveryRequest(
  input: DatamoonAudienceImportRequest,
): DatamoonAudienceImportRequest {
  return stripAutonomousBroadProviderQualificationFromRequest(input)
}

export { GROWTH_DATAMOON_AUTONOMOUS_BROAD_SEARCH_SIGNAL_1A_QA_MARKER }
