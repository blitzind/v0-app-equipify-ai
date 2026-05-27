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

function scorePeopleSignalRelevance(draft: GrowthNormalizedSignalDraft): number {
  if (draft.signal_type !== "job_change" && draft.signal_type !== "promotion") return 0

  let score = 0
  const metadata = readMetadataRecord(draft)
  const identityConfidence =
    typeof metadata.identity_confidence === "number" ? metadata.identity_confidence : 0
  const department = asLower(draft.category)
  const seniority = asLower(draft.seniority)
  const ageDays = Math.max(0, (Date.now() - parseOccurredAtMs(draft.occurred_at)) / (1000 * 60 * 60 * 24))

  if (["director", "vp", "c_suite"].includes(seniority)) score += 6
  if (ICP_JOB_DEPARTMENTS.has(department)) score += 4
  if (draft.domain?.trim()) score += 3
  if (ageDays <= 30) score += 4
  if (identityConfidence >= 0.9) score += 4
  else if (identityConfidence >= 0.75) score += 2
  if (draft.signal_type === "promotion" && seniority === "director") score += 3

  return clamp(score, 0, 15)
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

const ICP_JOB_DEPARTMENTS = new Set([
  "field service",
  "operations",
  "dispatch",
  "biomedical",
  "facilities",
  "warehouse",
])

function readMetadataRecord(draft: GrowthNormalizedSignalDraft): Record<string, unknown> {
  return draft.metadata && typeof draft.metadata === "object" ? draft.metadata : {}
}

function scoreJobHiringRelevance(draft: GrowthNormalizedSignalDraft): number {
  if (draft.signal_type !== "job_posting" && draft.signal_type !== "hire") return 0

  let score = 0
  const metadata = readMetadataRecord(draft)
  const department = asLower(draft.category)
  const roleFamily = asLower(metadata.role_family)
  const operationalRelevance = asLower(metadata.operational_relevance)
  const hiringVelocity =
    metadata.hiring_velocity && typeof metadata.hiring_velocity === "object"
      ? (metadata.hiring_velocity as Record<string, unknown>)
      : null

  if (ICP_JOB_DEPARTMENTS.has(department)) score += 4
  if (roleFamily === "technician") score += 4
  if (department === "dispatch" || roleFamily === "dispatcher") score += 3
  if (operationalRelevance === "high") score += 3

  const indicators = Array.isArray(metadata.hiring_intent_indicators)
    ? metadata.hiring_intent_indicators.filter((entry): entry is string => typeof entry === "string")
    : []
  if (indicators.includes("field_ops_expansion")) score += 2
  if (indicators.includes("multi_location_hiring")) score += 2

  if (hiringVelocity) {
    const intensity = asLower(hiringVelocity.hiring_intensity)
    const velocity7d = typeof hiringVelocity.hiring_velocity_7d === "number" ? hiringVelocity.hiring_velocity_7d : 0
    const spike = hiringVelocity.hiring_spike === true
    if (intensity === "high") score += 4
    else if (intensity === "medium") score += 2
    if (velocity7d >= 3) score += 2
    if (spike) score += 3
  }

  const titleHaystack = asLower(draft.title)
  if (titleHaystack.includes("technician") || titleHaystack.includes("dispatch")) score += 2

  return clamp(score, 0, 15)
}

function asLower(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
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
  const jobHiringRelevance = scoreJobHiringRelevance(draft)
  const peopleSignalRelevance = scorePeopleSignalRelevance(draft)
  const territoryRelevance = draft.geography?.trim() ? 3 : 0

  const signal_score = clamp(
    typeBase +
      recency +
      evidence +
      companyFit +
      roleSeniority +
      buyingRelevance +
      jobHiringRelevance +
      peopleSignalRelevance +
      territoryRelevance,
    0,
    100,
  )

  const metadata = readMetadataRecord(draft)
  const identityConfidence =
    typeof metadata.identity_confidence === "number" ? metadata.identity_confidence : null

  const confidence = clamp(
    identityConfidence != null
      ? identityConfidence * 0.85 + (evidence / 20) * 0.15
      : 0.35 + (evidence / 20) * 0.25 + (companyFit / 10) * 0.2 + (recency / 20) * 0.2,
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
        job_hiring_relevance: jobHiringRelevance,
        people_signal_relevance: peopleSignalRelevance,
        territory_relevance: territoryRelevance,
      },
    },
  }
}
