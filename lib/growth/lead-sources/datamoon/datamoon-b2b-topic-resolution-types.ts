/** GE-DATAMOON-B2B-TOPIC-RESOLUTION-1 — B2B topic resolution types (client-safe). */

export const GROWTH_DATAMOON_B2B_TOPIC_RESOLUTION_1_QA_MARKER =
  "ge-datamoon-b2b-topic-resolution-1-v1" as const

export const GROWTH_DATAMOON_B2B_TOPIC_RESOLUTION_NO_MATCH_ERROR =
  "No Datamoon B2B topics matched this search. Refine the topic or use Advanced Search." as const

export type DatamoonResolvedB2bTopic = {
  originalQuery: string
  topic_id: string
  label: string
  match_score: number | null
  match_method: string | null
}

export function isDatamoonNumericTopicId(value: string): boolean {
  return /^\d+$/.test(value.trim())
}
