/** GE-DATAMOON-B2B-QUERY-BROADEN-1 — B2B topic broadening + ICP priority ranking (client-safe). */

import type { DatamoonResolvedB2bTopic } from "@/lib/growth/lead-sources/datamoon/datamoon-b2b-topic-resolution-types"
import { DATAMOON_MAX_TOPIC_IDS } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"

export const GROWTH_DATAMOON_B2B_QUERY_BROADEN_1_QA_MARKER =
  "ge-datamoon-b2b-query-broaden-1-v1" as const

/** Equipify ICP — broader B2B topics preferred over narrow plan/product-specific matches. */
export const EQUIPIFY_ICP_B2B_TOPIC_PRIORITY_IDS = [
  "4690",
  "48172",
  "22005",
  "1897",
  "927",
  "48175",
] as const

export const EQUIPIFY_ICP_B2B_TOPIC_PRIORITY_LABELS: Record<string, string> = {
  "4690": "Medical Equipment",
  "48172": "Industrial Equipment Maintenance",
  "22005": "Equipment Maintenance Software",
  "1897": "Field Service Management",
  "927": "Maintenance, Repair and Overhaul (MRO)",
  "48175": "Large Machinery Maintenance",
}

const EQUIPMENT_ICP_QUERY_PATTERN =
  /equipment|maintenance|service|biomedical|medical|machinery|field service|repair/i

const BROADENING_ANCHOR_QUERIES = [
  "medical equipment",
  "industrial equipment maintenance",
  "equipment maintenance software",
  "field service management",
  "maintenance repair overhaul",
] as const

export const DATAMOON_REPEATED_FILTER_AND_SEMANTICS_NOTE =
  "Datamoon audience filters are combined with AND semantics; repeated same-field filters narrow results." as const

function normalizeTopicQuery(value: string): string {
  return value.trim().toLowerCase()
}

export function expandDatamoonB2bTopicSearchQueries(queries: readonly string[]): string[] {
  const output: string[] = []
  const seen = new Set<string>()

  const add = (value: string) => {
    const trimmed = value.trim()
    const key = normalizeTopicQuery(trimmed)
    if (trimmed.length < 3 || seen.has(key)) return
    seen.add(key)
    output.push(trimmed)
  }

  for (const query of queries) add(query)

  const shouldBroaden = queries.some((query) => EQUIPMENT_ICP_QUERY_PATTERN.test(query))
  if (shouldBroaden) {
    for (const anchor of BROADENING_ANCHOR_QUERIES) add(anchor)
  }

  return output
}

export type DatamoonB2bTopicCandidate = DatamoonResolvedB2bTopic & {
  searchQuery: string
}

function icpPriorityIndex(topicId: string): number {
  const index = EQUIPIFY_ICP_B2B_TOPIC_PRIORITY_IDS.indexOf(
    topicId as (typeof EQUIPIFY_ICP_B2B_TOPIC_PRIORITY_IDS)[number],
  )
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}

export function rankDatamoonB2bTopicCandidates(candidates: readonly DatamoonB2bTopicCandidate[]): DatamoonB2bTopicCandidate[] {
  return [...candidates].sort((left, right) => {
    const icpDelta = icpPriorityIndex(left.topic_id) - icpPriorityIndex(right.topic_id)
    if (icpDelta !== 0) return icpDelta
    return (right.match_score ?? 0) - (left.match_score ?? 0)
  })
}

export function selectBroadenedDatamoonB2bTopics(
  candidates: readonly DatamoonB2bTopicCandidate[],
): { matches: DatamoonResolvedB2bTopic[]; topic_ids: string[] } {
  const ranked = rankDatamoonB2bTopicCandidates(candidates)
  const seenTopicIds = new Set<string>()
  const matches: DatamoonResolvedB2bTopic[] = []
  const topic_ids: string[] = []

  for (const candidate of ranked) {
    if (seenTopicIds.has(candidate.topic_id)) continue
    seenTopicIds.add(candidate.topic_id)
    matches.push({
      originalQuery: candidate.originalQuery,
      topic_id: candidate.topic_id,
      label: candidate.label,
      match_score: candidate.match_score,
      match_method: candidate.match_method,
    })
    topic_ids.push(candidate.topic_id)
    if (topic_ids.length >= DATAMOON_MAX_TOPIC_IDS) break
  }

  return { matches, topic_ids }
}
