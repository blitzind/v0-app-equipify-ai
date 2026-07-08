/** GE-DATAMOON-B2B-TOPIC-RESOLUTION-1 — Resolve workbench topic strings to Datamoon B2B topic IDs (server-only). */

import "server-only"

import { logGrowthEngine } from "@/lib/growth/access"
import { DATAMOON_ENRICHMENT_BASE_URL, isDatamoonDryRunOnly } from "@/lib/growth/providers/datamoon/datamoon-config"
import type { DatamoonFetchImpl } from "@/lib/growth/providers/datamoon/datamoon-http"
import {
  GROWTH_DATAMOON_B2B_TOPIC_RESOLUTION_1_QA_MARKER,
  type DatamoonResolvedB2bTopic,
} from "@/lib/growth/lead-sources/datamoon/datamoon-b2b-topic-resolution-types"
import { DATAMOON_MAX_TOPIC_IDS } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"

const DATAMOON_B2B_TOPIC_SEARCH_PATH = "/b2b-topics/search" as const

const DRY_RUN_B2B_TOPIC_ID_BY_QUERY: Record<string, string> = {
  "equipment maintenance software": "22005",
  "medical equipment service": "4690",
  "public safety equipment service": "3936",
  "field service management": "1897",
  "repair and maintenance operations": "927",
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
    const dryRunId = DRY_RUN_B2B_TOPIC_ID_BY_QUERY[normalizeTopicQuery(query)] ?? "4690"
    return [
      {
        originalQuery: query,
        topic_id: dryRunId,
        label: query,
        match_score: 90,
        match_method: "dry_run",
      },
    ]
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
  options?: { fetchImpl?: DatamoonFetchImpl; env?: NodeJS.ProcessEnv },
): Promise<{ matches: DatamoonResolvedB2bTopic[]; topic_ids: string[] }> {
  const seenQueries = new Set<string>()
  const seenTopicIds = new Set<string>()
  const matches: DatamoonResolvedB2bTopic[] = []
  const topic_ids: string[] = []

  for (const rawQuery of queries) {
    const query = rawQuery.trim()
    if (!query) continue
    const dedupeKey = normalizeTopicQuery(query)
    if (seenQueries.has(dedupeKey)) continue
    seenQueries.add(dedupeKey)

    const results = await searchDatamoonB2bTopics(query, options)
    const top = results[0]
    if (!top || seenTopicIds.has(top.topic_id)) continue

    seenTopicIds.add(top.topic_id)
    matches.push(top)
    topic_ids.push(top.topic_id)
    if (topic_ids.length >= DATAMOON_MAX_TOPIC_IDS) break
  }

  logGrowthEngine("datamoon_b2b_topic_resolution", {
    qa_marker: GROWTH_DATAMOON_B2B_TOPIC_RESOLUTION_1_QA_MARKER,
    query_count: seenQueries.size,
    resolved_count: matches.length,
    topic_ids,
    resolved_topics: matches.map((match) => ({
      originalQuery: match.originalQuery,
      topic_id: match.topic_id,
      label: match.label,
      match_score: match.match_score,
      match_method: match.match_method,
    })),
  })

  return { matches, topic_ids }
}
