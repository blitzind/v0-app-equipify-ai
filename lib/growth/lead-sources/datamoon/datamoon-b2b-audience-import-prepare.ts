/** GE-DATAMOON-B2B-TOPIC-RESOLUTION-1 — Prepare B2B Datamoon import requests before build (server-only). */

import "server-only"

import { datamoonImportRequestIntendsB2bAudience } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-draft-builder"
import {
  appendDatamoonB2bIntentFiltersFromWorkbenchContext,
  mapDatamoonFiltersToProviderFilters,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-filter-mapping"
import type { DatamoonAudienceImportRequest } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import { resolveDatamoonB2bTopicQueries } from "@/lib/growth/lead-sources/datamoon/datamoon-b2b-topic-resolver"
import {
  GROWTH_DATAMOON_B2B_TOPIC_RESOLUTION_NO_MATCH_ERROR,
} from "@/lib/growth/lead-sources/datamoon/datamoon-b2b-topic-resolution-types"
import type { DatamoonFetchImpl } from "@/lib/growth/providers/datamoon/datamoon-http"
import { normalizeDatamoonTopicIds } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-draft-builder"
import { mergeDatamoonOperationalTopicSearchQueries } from "@/lib/growth/lead-sources/datamoon/datamoon-operational-model-targeting-1a"

export async function prepareDatamoonAudienceImportRequestForBuild(
  input: DatamoonAudienceImportRequest,
  options?: { fetchImpl?: DatamoonFetchImpl; env?: NodeJS.ProcessEnv },
): Promise<
  | { ok: true; request: DatamoonAudienceImportRequest }
  | { ok: false; error: string; issues?: Array<{ code: string; field?: string; message: string }> }
> {
  if (!datamoonImportRequestIntendsB2bAudience(input)) {
    return { ok: true, request: input }
  }

  const topicQueries = mergeDatamoonOperationalTopicSearchQueries({
    topicPhrases: normalizeDatamoonTopicIds(input.workbench_context?.topics ?? []),
    supplementalTopicSearchQueries: input.workbench_context?.supplementalTopicSearchQueries,
  })
  if (topicQueries.length === 0) {
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

  const resolution = await resolveDatamoonB2bTopicQueries(topicQueries, {
    ...options,
    clusterBroadeningAnchors: input.workbench_context?.clusterBroadeningAnchors,
    multiVerticalProfile: (input.workbench_context?.clusterBroadeningAnchors?.length ?? 0) > 0,
  })
  if (resolution.topic_ids.length === 0) {
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

  const withIntentFilters = appendDatamoonB2bIntentFiltersFromWorkbenchContext(
    input.filters,
    input.workbench_context,
  )
  const mappedFilters = mapDatamoonFiltersToProviderFilters(withIntentFilters)

  return {
    ok: true,
    request: {
      ...input,
      audience_type: "b2b",
      topic_ids: resolution.topic_ids,
      filters: mappedFilters.providerFilters,
      workbench_context: {
        ...input.workbench_context,
        topics: normalizeDatamoonTopicIds(input.workbench_context?.topics ?? []),
        broadenedTopicSearchQueries: resolution.broadenedTopicSearchQueries,
        resolvedB2bTopics: resolution.matches,
        omittedWorkbenchFilterFields: [
          ...new Set([
            ...(input.workbench_context?.omittedWorkbenchFilterFields ?? []),
            ...mappedFilters.omittedWorkbenchFilterFields,
          ]),
        ],
      },
    },
  }
}
