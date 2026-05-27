import type {
  GrowthNormalizedSignalDraft,
  GrowthSignalScoringResult,
  GrowthSignalType,
  GrowthSignalUrgency,
} from "@/lib/growth/signals/signal-types"

const SIGNAL_TYPE_BASE_SCORE: Record<GrowthSignalType, number> = {
  website_visitor: 18,
  job_change: 22,
  promotion: 20,
  hire: 16,
  job_posting: 17,
  news_event: 12,
  tech_install: 14,
  funding_event: 19,
  search_intent: 15,
  manual_signal: 10,
}

const SENIORITY_BOOST: Record<string, number> = {
  c_suite: 15,
  vp: 12,
  director: 10,
  manager: 6,
  individual: 2,
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function parseOccurredAtMs(occurredAt: string): number {
  const ms = Date.parse(occurredAt)
  return Number.isFinite(ms) ? ms : Date.now()
}

function scoreRecency(occurredAt: string, signalType: GrowthSignalType): number {
  const ageDays = Math.max(0, (Date.now() - parseOccurredAtMs(occurredAt)) / (1000 * 60 * 60 * 24))
  const halfLife =
    signalType === "job_change" || signalType === "promotion"
      ? 14
      : signalType === "website_visitor" || signalType === "search_intent"
        ? 7
        : 30
  const decay = Math.pow(0.5, ageDays / halfLife)
  return clamp(Math.round(decay * 20), 0, 20)
}

function scoreEvidenceStrength(draft: GrowthNormalizedSignalDraft): number {
  const count = draft.evidence.length
  const hasUrl = draft.evidence.some((entry) => Boolean(entry.source_url?.trim()))
  let score = clamp(count * 4, 0, 12)
  if (hasUrl) score += 8
  return clamp(score, 0, 20)
}

function scoreCompanyFit(draft: GrowthNormalizedSignalDraft): number {
  let score = 0
  if (draft.company_id) score += 6
  if (draft.domain?.trim()) score += 4
  return clamp(score, 0, 10)
}

function scoreRoleSeniority(draft: GrowthNormalizedSignalDraft): number {
  const key = draft.seniority?.trim().toLowerCase().replace(/\s+/g, "_") ?? ""
  return SENIORITY_BOOST[key] ?? (draft.title?.trim() ? 4 : 0)
}

function scoreBuyingRelevance(draft: GrowthNormalizedSignalDraft): number {
  const haystack = [draft.category, draft.title, draft.industry]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  if (!haystack) return 0
  const keywords = ["operations", "service", "field", "maintenance", "equipment", "facilities"]
  const hits = keywords.filter((word) => haystack.includes(word)).length
  return clamp(hits * 3, 0, 15)
}

function urgencyFromScore(signalType: GrowthSignalType, signalScore: number): GrowthSignalUrgency {
  if (signalScore >= 80) return "urgent"
  if (signalScore >= 65) return "high"
  if (signalScore >= 40) return "normal"
  if (signalType === "job_change" && signalScore >= 30) return "normal"
  return "low"
}

export function scoreSignalV1(draft: GrowthNormalizedSignalDraft): GrowthSignalScoringResult {
  const typeBase = SIGNAL_TYPE_BASE_SCORE[draft.signal_type] ?? 10
  const recency = scoreRecency(draft.occurred_at, draft.signal_type)
  const evidence = scoreEvidenceStrength(draft)
  const companyFit = scoreCompanyFit(draft)
  const roleSeniority = scoreRoleSeniority(draft)
  const buyingRelevance = scoreBuyingRelevance(draft)
  const territoryRelevance = draft.geography?.trim() ? 3 : 0

  const signal_score = clamp(
    typeBase + recency + evidence + companyFit + roleSeniority + buyingRelevance + territoryRelevance,
    0,
    100,
  )

  const confidence = clamp(
    0.35 +
      (evidence / 20) * 0.25 +
      (companyFit / 10) * 0.2 +
      (recency / 20) * 0.2,
    0,
    1,
  )

  const urgency = urgencyFromScore(draft.signal_type, signal_score)
  const routing_priority = clamp(Math.round(signal_score / 10), 0, 10)

  return {
    signal_score,
    confidence: Number(confidence.toFixed(3)),
    urgency,
    routing_priority,
    scoring_metadata: {
      version: "v1",
      components: {
        type_base: typeBase,
        recency,
        evidence,
        company_fit: companyFit,
        role_seniority: roleSeniority,
        buying_relevance: buyingRelevance,
        territory_relevance: territoryRelevance,
      },
    },
  }
}
