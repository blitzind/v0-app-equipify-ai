/** GE-DATAMOON-B2B-TOPIC-RESOLUTION-1 / GE-DATAMOON-B2B-QUERY-BROADEN-1 — Resolve workbench topic strings to Datamoon B2B topic IDs (server-only). */

import "server-only"

import { logGrowthEngine } from "@/lib/growth/access"
import {
  expandDatamoonB2bTopicSearchQueries,
  GROWTH_DATAMOON_B2B_QUERY_BROADEN_1_QA_MARKER,
  selectBroadenedDatamoonB2bTopics,
  type DatamoonB2bTopicCandidate,
} from "@/lib/growth/lead-sources/datamoon/datamoon-b2b-topic-broadening"
import {
  GROWTH_DATAMOON_B2B_TOPIC_RESOLUTION_1_QA_MARKER,
  type DatamoonResolvedB2bTopic,
} from "@/lib/growth/lead-sources/datamoon/datamoon-b2b-topic-resolution-types"
import { DATAMOON_ENRICHMENT_BASE_URL, isDatamoonDryRunOnly } from "@/lib/growth/providers/datamoon/datamoon-config"
import type { DatamoonFetchImpl } from "@/lib/growth/providers/datamoon/datamoon-http"

const DATAMOON_B2B_TOPIC_SEARCH_PATH = "/b2b-topics/search" as const

const DRY_RUN_B2B_TOPIC_SEARCH: Record<string, DatamoonResolvedB2bTopic[]> = {
  "medical equipment service": [
    {
      originalQuery: "medical equipment service",
      topic_id: "4690",
      label: "Medical Equipment",
      match_score: 80.7,
      match_method: "dry_run",
    },
    {
      originalQuery: "medical equipment service",
      topic_id: "48172",
      label: "Industrial Equipment Maintenance",
      match_score: 78.4,
      match_method: "dry_run",
    },
    {
      originalQuery: "medical equipment service",
      topic_id: "22005",
      label: "Equipment Maintenance Software",
      match_score: 78.5,
      match_method: "dry_run",
    },
  ],
  "medical equipment": [
    {
      originalQuery: "medical equipment",
      topic_id: "4690",
      label: "Medical Equipment",
      match_score: 95,
      match_method: "dry_run",
    },
  ],
  "industrial equipment maintenance": [
    {
      originalQuery: "industrial equipment maintenance",
      topic_id: "48172",
      label: "Industrial Equipment Maintenance",
      match_score: 95,
      match_method: "dry_run",
    },
  ],
  "equipment maintenance software": [
    {
      originalQuery: "equipment maintenance software",
      topic_id: "22005",
      label: "Equipment Maintenance Software",
      match_score: 94.5,
      match_method: "dry_run",
    },
  ],
  "field service management": [
    {
      originalQuery: "field service management",
      topic_id: "1897",
      label: "Field Service Management",
      match_score: 95,
      match_method: "dry_run",
    },
  ],
  "maintenance repair overhaul": [
    {
      originalQuery: "maintenance repair overhaul",
      topic_id: "927",
      label: "Maintenance, Repair and Overhaul (MRO)",
      match_score: 90,
      match_method: "dry_run",
    },
  ],
  "public safety equipment service": [
    {
      originalQuery: "public safety equipment service",
      topic_id: "3936",
      label: "Safety Supplies",
      match_score: 90,
      match_method: "dry_run",
    },
  ],
  "repair and maintenance operations": [
    {
      originalQuery: "repair and maintenance operations",
      topic_id: "927",
      label: "Maintenance, Repair and Overhaul (MRO)",
      match_score: 88,
      match_method: "dry_run",
    },
  ],
}

type DatamoonB2bTopicSearchResponse = {
  success?: boolean
  data?: Array<{
    topic_id?: string | number
    label?: string
    topic?: string
    match_score?: number
    match_method?: string
  }>
}

function normalizeTopicQuery(value: string): string {
  return value.trim().toLowerCase()
}

function mapSearchHit(query: string, hit: NonNullable<DatamoonB2bTopicSearchResponse["data"]>[number]): DatamoonResolvedB2bTopic | null {
  const topicId = hit.topic_id != null ? String(hit.topic_id).trim() : ""
  if (!/^\d+$/.test(topicId)) return null
  const label = (hit.label ?? hit.topic ?? query).trim() || query
  return {
    originalQuery: query,
    topic_id: topicId,
    label,
    match_score: typeof hit.match_score === "number" && Number.isFinite(hit.match_score) ? hit.match_score : null,
    match_method: typeof hit.match_method === "string" ? hit.match_method : null,
  }
}

export async function searchDatamoonB2bTopics(
  keywords: string,
  options?: { fetchImpl?: DatamoonFetchImpl; env?: NodeJS.ProcessEnv },
): Promise<DatamoonResolvedB2bTopic[]> {
  const query = keywords.trim()
  if (query.length < 3) return []

  const env = options?.env ?? process.env
  if (isDatamoonDryRunOnly(env)) {
    return DRY_RUN_B2B_TOPIC_SEARCH[normalizeTopicQuery(query)] ?? []
  }

  const fetchImpl = options?.fetchImpl ?? fetch
  const url = new URL(`${DATAMOON_ENRICHMENT_BASE_URL}${DATAMOON_B2B_TOPIC_SEARCH_PATH}`)
  url.searchParams.set("keywords", query)
  url.searchParams.set("mode", "auto")

  const response = await fetchImpl(url.toString(), { method: "GET" })
  if (!response.ok) return []

  let payload: DatamoonB2bTopicSearchResponse
  try {
    payload = (await response.json()) as DatamoonB2bTopicSearchResponse
  } catch {
    return []
  }

  if (!payload.success || !Array.isArray(payload.data)) return []

  const matches: DatamoonResolvedB2bTopic[] = []
  for (const hit of payload.data) {
    const mapped = mapSearchHit(query, hit)
    if (mapped) matches.push(mapped)
  }
  return matches
}

export async function resolveDatamoonB2bTopicQueries(
  queries: readonly string[],
  options?: {
    fetchImpl?: DatamoonFetchImpl
    env?: NodeJS.ProcessEnv
    clusterBroadeningAnchors?: readonly string[]
    multiVerticalProfile?: boolean
  },
): Promise<{
  matches: DatamoonResolvedB2bTopic[]
  topic_ids: string[]
  broadenedTopicSearchQueries: string[]
}> {
  const broadenedTopicSearchQueries = expandDatamoonB2bTopicSearchQueries(queries, {
    clusterBroadeningAnchors: options?.clusterBroadeningAnchors,
    multiVerticalProfile: options?.multiVerticalProfile,
  })
  const candidates: DatamoonB2bTopicCandidate[] = []
  const seenCandidateKeys = new Set<string>()

  for (const searchQuery of broadenedTopicSearchQueries) {
    const results = await searchDatamoonB2bTopics(searchQuery, options)
    for (const result of results) {
      const key = `${result.topic_id}:${normalizeTopicQuery(result.originalQuery)}`
      if (seenCandidateKeys.has(key)) continue
      seenCandidateKeys.add(key)
      candidates.push({ ...result, searchQuery })
    }
  }

  const selected = selectBroadenedDatamoonB2bTopics(candidates)

  logGrowthEngine("datamoon_b2b_topic_resolution", {
    qa_marker: GROWTH_DATAMOON_B2B_TOPIC_RESOLUTION_1_QA_MARKER,
    broaden_qa_marker: GROWTH_DATAMOON_B2B_QUERY_BROADEN_1_QA_MARKER,
    query_count: queries.length,
    broadened_query_count: broadenedTopicSearchQueries.length,
    candidate_count: candidates.length,
    resolved_count: selected.matches.length,
    topic_ids: selected.topic_ids,
    broadened_topic_search_queries: broadenedTopicSearchQueries,
    resolved_topics: selected.matches.map((match) => ({
      originalQuery: match.originalQuery,
      topic_id: match.topic_id,
      label: match.label,
      match_score: match.match_score,
      match_method: match.match_method,
    })),
  })

  return {
    ...selected,
    broadenedTopicSearchQueries,
  }
}
