/** AVA-DISCOVERY-BROAD-SEARCH-SIGNAL-RECOVERY-1A — Resolve broad discovery topic signal for autonomous portfolio (server-only). */

import "server-only"

import { normalizeDatamoonTopicIds } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-draft-builder"
import {
  mapDatamoonFiltersToProviderFilters,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-filter-mapping"
import type { DatamoonAudienceImportRequest } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import {
  stripAutonomousBroadProviderQualificationFromRequest,
} from "@/lib/growth/lead-sources/datamoon/datamoon-autonomous-broad-provider-discovery-1a"
import {
  AUTONOMOUS_BROAD_DISCOVERY_MAX_TOPIC_IDS,
  GROWTH_DATAMOON_AUTONOMOUS_BROAD_SEARCH_SIGNAL_1A_QA_MARKER,
  limitAutonomousBroadDiscoveryTopicIds,
} from "@/lib/growth/lead-sources/datamoon/datamoon-autonomous-broad-search-signal-1a"
import { buildDatamoonB2bTopicRankingSignalsFromWorkbenchContext } from "@/lib/growth/lead-sources/datamoon/datamoon-b2b-topic-broadening"
import { resolveDatamoonB2bTopicQueries } from "@/lib/growth/lead-sources/datamoon/datamoon-b2b-topic-resolver"
import {
  GROWTH_DATAMOON_B2B_TOPIC_RESOLUTION_NO_MATCH_ERROR,
} from "@/lib/growth/lead-sources/datamoon/datamoon-b2b-topic-resolution-types"
import type { DatamoonFetchImpl } from "@/lib/growth/providers/datamoon/datamoon-http"

export async function prepareAutonomousBroadSearchSignalDiscoveryRequest(
  input: DatamoonAudienceImportRequest,
  options?: { fetchImpl?: DatamoonFetchImpl; env?: NodeJS.ProcessEnv },
): Promise<
  | { ok: true; request: DatamoonAudienceImportRequest }
  | { ok: false; error: string; issues?: Array<{ code: string; field?: string; message: string }> }
> {
  const stripped = stripAutonomousBroadProviderQualificationFromRequest(input)
  const topicQueries = normalizeDatamoonTopicIds(stripped.workbench_context?.topics ?? [])
  const primaryQuery = topicQueries[0]?.trim() ?? stripped.workbench_context?.providerDiscoveryConcept?.trim()

  if (!primaryQuery || primaryQuery.length < 3) {
    return {
      ok: false,
      error: "autonomous_broad_discovery_concept_missing",
      issues: [
        {
          code: "autonomous_broad_discovery_concept_missing",
          field: "workbench_context.topics",
          message: "Autonomous broad discovery requires a provider discovery concept.",
        },
      ],
    }
  }

  const topicRankingSignals = buildDatamoonB2bTopicRankingSignalsFromWorkbenchContext({
    topics: [primaryQuery],
    topicRankingSignals: stripped.workbench_context?.topicRankingSignals,
  })

  const resolution = await resolveDatamoonB2bTopicQueries([primaryQuery], {
    ...options,
    clusterBroadeningAnchors: undefined,
    multiVerticalProfile: false,
    topicRankingSignals,
    maxTopicIds: AUTONOMOUS_BROAD_DISCOVERY_MAX_TOPIC_IDS,
  })

  const topic_ids = limitAutonomousBroadDiscoveryTopicIds(resolution.topic_ids)
  if (topic_ids.length === 0) {
    return {
      ok: false,
      error: GROWTH_DATAMOON_B2B_TOPIC_RESOLUTION_NO_MATCH_ERROR,
      issues: [
        {
          code: "datamoon_b2b_topics_unresolved",
          field: "topic_ids",
          message: GROWTH_DATAMOON_B2B_TOPIC_RESOLUTION_NO_MATCH_ERROR,
        },
      ],
    }
  }

  const mappedFilters = mapDatamoonFiltersToProviderFilters(stripped.filters)
  const resolvedMatches = resolution.matches.filter((row) => topic_ids.includes(row.topic_id))

  return {
    ok: true,
    request: {
      ...stripped,
      audience_type: "b2b",
      topic_ids,
      filters: mappedFilters.providerFilters,
      workbench_context: {
        ...stripped.workbench_context,
        topics: [primaryQuery],
        broadenedTopicSearchQueries: [primaryQuery],
        resolvedB2bTopics: resolvedMatches,
        autonomousBroadSearchSignal: true,
        qualificationFiltersDeferred: true,
        providerDiscoveryConcept: primaryQuery,
        broadDiscoveryObservability: stripped.workbench_context?.broadDiscoveryObservability,
        omittedWorkbenchFilterFields: [
          ...new Set([
            ...(stripped.workbench_context?.omittedWorkbenchFilterFields ?? []),
            ...mappedFilters.omittedWorkbenchFilterFields,
          ]),
        ],
      },
    },
  }
}

export { GROWTH_DATAMOON_AUTONOMOUS_BROAD_SEARCH_SIGNAL_1A_QA_MARKER }
