/** GE-DATAMOON-B2B-QUERY-BROADEN-1 / GE-AIOS-DATAMOON-TOPIC-RANKING-NEUTRALIZATION-1A — B2B topic broadening + tenant-derived topic ranking (client-safe). */

import type { DatamoonResolvedB2bTopic } from "@/lib/growth/lead-sources/datamoon/datamoon-b2b-topic-resolution-types"
import { DATAMOON_MAX_TOPIC_IDS } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"

export const GROWTH_DATAMOON_B2B_QUERY_BROADEN_1_QA_MARKER =
  "ge-datamoon-b2b-query-broaden-1-v1" as const

export const GROWTH_DATAMOON_B2B_TOPIC_RANKING_NEUTRALIZATION_1A_QA_MARKER =
  "ge-aios-datamoon-topic-ranking-neutralization-1a-v1" as const

const EQUIPMENT_ICP_QUERY_PATTERN =
  /equipment|maintenance|service|biomedical|medical|machinery|field service|repair/i

export const DATAMOON_REPEATED_FILTER_AND_SEMANTICS_NOTE =
  "Datamoon audience filters are combined with AND semantics; repeated same-field filters narrow results." as const

export const DATAMOON_B2B_TOPIC_RANKING_NEUTRAL_FALLBACK_NOTE =
  "When OMT ranking signals are absent, provider topic candidates preserve match_score ordering only." as const

export type DatamoonB2bTopicRankingSignals = {
  topicPhrases?: readonly string[]
  operationalConceptPhrases?: readonly string[]
  qualificationTopicPhrases?: readonly string[]
  supplementalAliases?: readonly string[]
  clusterBroadeningAnchors?: readonly string[]
}

const TIER_TOPIC_PHRASES = 0
const TIER_OPERATIONAL_CONCEPTS = 1
const TIER_QUALIFICATION = 2
const TIER_SUPPLEMENTAL = 3
const TIER_REMAINDER = 4

function normalizeTopicQuery(value: string): string {
  return value.trim().toLowerCase()
}

function queryMatchesPhrase(searchQuery: string, phrase: string): boolean {
  const key = normalizeTopicQuery(searchQuery)
  const normalized = normalizeTopicQuery(phrase)
  if (key.length < 3 || normalized.length < 3) return false
  return key === normalized || key.includes(normalized) || normalized.includes(key)
}

function resolveQueryTier(searchQuery: string, signals: DatamoonB2bTopicRankingSignals): number {
  const inTier = (phrases: readonly string[] | undefined, tier: number): number | null => {
    if (!phrases?.length) return null
    for (const phrase of phrases) {
      if (queryMatchesPhrase(searchQuery, phrase)) return tier
    }
    return null
  }

  return (
    inTier(signals.topicPhrases, TIER_TOPIC_PHRASES) ??
    inTier(signals.operationalConceptPhrases, TIER_OPERATIONAL_CONCEPTS) ??
    inTier(signals.qualificationTopicPhrases, TIER_QUALIFICATION) ??
    inTier(
      [...(signals.supplementalAliases ?? []), ...(signals.clusterBroadeningAnchors ?? [])],
      TIER_SUPPLEMENTAL,
    ) ??
    TIER_REMAINDER
  )
}

function resolvePhraseIndex(searchQuery: string, phrases: readonly string[] | undefined): number {
  if (!phrases?.length) return Number.MAX_SAFE_INTEGER
  for (let index = 0; index < phrases.length; index += 1) {
    if (queryMatchesPhrase(searchQuery, phrases[index]!)) return index
  }
  return Number.MAX_SAFE_INTEGER
}

function narrowTopicLabelPenalty(label: string, signals: DatamoonB2bTopicRankingSignals): number {
  const lower = label.trim().toLowerCase()
  const corpus = [
    ...(signals.topicPhrases ?? []),
    ...(signals.operationalConceptPhrases ?? []),
    ...(signals.qualificationTopicPhrases ?? []),
    ...(signals.supplementalAliases ?? []),
    ...(signals.clusterBroadeningAnchors ?? []),
  ]
    .join(" ")
    .toLowerCase()

  let penalty = 0
  if (/\b(plan|software|platform|saas|erp|system)\b/.test(lower)) {
    if (!/\b(plan|software|platform|saas|erp|system)\b/.test(corpus)) penalty += 10
  }
  return penalty
}

function resolveCandidateTier(
  candidate: DatamoonB2bTopicCandidate,
  signals?: DatamoonB2bTopicRankingSignals,
): number {
  if (!signals) return TIER_REMAINDER
  const tiers = [
    resolveQueryTier(candidate.searchQuery, signals),
    resolveQueryTier(candidate.originalQuery, signals),
  ]
  return Math.min(...tiers)
}

function resolveCandidatePhraseIndex(
  candidate: DatamoonB2bTopicCandidate,
  signals?: DatamoonB2bTopicRankingSignals,
): number {
  if (!signals?.topicPhrases?.length) return Number.MAX_SAFE_INTEGER
  return Math.min(
    resolvePhraseIndex(candidate.searchQuery, signals.topicPhrases),
    resolvePhraseIndex(candidate.originalQuery, signals.topicPhrases),
  )
}

export type ExpandDatamoonB2bTopicSearchQueriesOptions = {
  clusterBroadeningAnchors?: readonly string[]
  multiVerticalProfile?: boolean
}

export function expandDatamoonB2bTopicSearchQueries(
  queries: readonly string[],
  options?: ExpandDatamoonB2bTopicSearchQueriesOptions,
): string[] {
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
  const clusterAnchors = options?.clusterBroadeningAnchors?.filter(Boolean) ?? []
  if (shouldBroaden && clusterAnchors.length > 0) {
    for (const anchor of clusterAnchors) add(anchor)
  }

  return output
}

export type DatamoonB2bTopicCandidate = DatamoonResolvedB2bTopic & {
  searchQuery: string
}

export function rankDatamoonB2bTopicCandidates(
  candidates: readonly DatamoonB2bTopicCandidate[],
  signals?: DatamoonB2bTopicRankingSignals,
): DatamoonB2bTopicCandidate[] {
  return [...candidates].sort((left, right) => {
    const tierDelta = resolveCandidateTier(left, signals) - resolveCandidateTier(right, signals)
    if (tierDelta !== 0) return tierDelta

    if (signals) {
      const phraseIndexDelta =
        resolveCandidatePhraseIndex(left, signals) - resolveCandidatePhraseIndex(right, signals)
      if (phraseIndexDelta !== 0) return phraseIndexDelta

      const penaltyDelta =
        narrowTopicLabelPenalty(left.label, signals) - narrowTopicLabelPenalty(right.label, signals)
      if (penaltyDelta !== 0) return penaltyDelta
    }

    const scoreDelta = (right.match_score ?? 0) - (left.match_score ?? 0)
    if (scoreDelta !== 0) return scoreDelta
    return left.topic_id.localeCompare(right.topic_id)
  })
}

export function selectBroadenedDatamoonB2bTopics(
  candidates: readonly DatamoonB2bTopicCandidate[],
  signals?: DatamoonB2bTopicRankingSignals,
): { matches: DatamoonResolvedB2bTopic[]; topic_ids: string[] } {
  const ranked = rankDatamoonB2bTopicCandidates(candidates, signals)
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

export function buildDatamoonB2bTopicRankingSignalsFromWorkbenchContext(input: {
  topics?: readonly string[]
  supplementalTopicSearchQueries?: readonly string[]
  clusterBroadeningAnchors?: readonly string[]
  topicRankingSignals?: DatamoonB2bTopicRankingSignals
}): DatamoonB2bTopicRankingSignals | undefined {
  if (input.topicRankingSignals) return input.topicRankingSignals

  const topicPhrases = input.topics?.map((value) => value.trim()).filter(Boolean) ?? []
  const supplementalAliases =
    input.supplementalTopicSearchQueries?.map((value) => value.trim()).filter(Boolean) ?? []
  const clusterBroadeningAnchors =
    input.clusterBroadeningAnchors?.map((value) => value.trim()).filter(Boolean) ?? []

  if (
    topicPhrases.length === 0 &&
    supplementalAliases.length === 0 &&
    clusterBroadeningAnchors.length === 0
  ) {
    return undefined
  }

  return {
    topicPhrases,
    supplementalAliases,
    clusterBroadeningAnchors,
  }
}
