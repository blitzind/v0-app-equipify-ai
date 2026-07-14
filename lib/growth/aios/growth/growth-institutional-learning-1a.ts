/**
 * GE-AIOS-INSTITUTIONAL-LEARNING-1A — Organizational sales intelligence (client-safe).
 * Reuses Learning Engine outcomes/insights — advisory only, never overrides account evidence.
 */

import type {
  GrowthLearningInsight,
  GrowthLearningOutcome,
} from "@/lib/growth/aios/learning/growth-closed-loop-learning-types"
import { GROWTH_LEARNING_MIN_SAMPLE_SIZE } from "@/lib/growth/aios/learning/growth-closed-loop-learning-types"
import {
  GROWTH_AIOS_INSTITUTIONAL_LEARNING_1A_QA_MARKER,
  INSTITUTIONAL_LEARNING_MAX_CONFIDENCE_BOOST,
  INSTITUTIONAL_LEARNING_MIN_CONFIDENCE,
  INSTITUTIONAL_LEARNING_MIN_SAMPLE_SIZE,
  type GrowthInstitutionalAccountContext,
  type GrowthInstitutionalAdvisoryDimension,
  type GrowthInstitutionalAdvisoryPattern,
  type GrowthInstitutionalOperatorInsight,
  type GrowthInstitutionalSalesIntelligence,
} from "@/lib/growth/aios/growth/growth-institutional-learning-1a-types"
import type { GrowthOutreachInstitutionalAdviceSnippet } from "@/lib/growth/aios/growth/growth-relationship-strategy-2a-types"

export {
  GROWTH_AIOS_INSTITUTIONAL_LEARNING_1A_QA_MARKER,
  GROWTH_AIOS_INSTITUTIONAL_LEARNING_1A_OPERATOR_LAYOUT_QA_MARKER,
  INSTITUTIONAL_LEARNING_DECISION_PRIORITY,
  INSTITUTIONAL_LEARNING_MIN_CONFIDENCE,
  INSTITUTIONAL_LEARNING_MIN_SAMPLE_SIZE,
} from "@/lib/growth/aios/growth/growth-institutional-learning-1a-types"

const POSITIVE_OUTCOME_TYPES = new Set([
  "reply",
  "positive_intent",
  "meeting_booked",
  "completed",
  "converted",
  "approved",
  "clicked",
  "viewed",
])

const NEGATIVE_OUTCOME_TYPES = new Set([
  "no_response",
  "negative_intent",
  "unsubscribe",
  "opt_out",
  "bounce",
  "rejected",
  "stalled",
  "cancelled",
  "failed",
])

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function daysSince(iso: string, referenceIso: string): number {
  const delta = Date.parse(referenceIso) - Date.parse(iso)
  if (!Number.isFinite(delta) || delta < 0) return 0
  return Math.floor(delta / 86400000)
}

function freshnessScore(freshnessDays: number): number {
  if (freshnessDays <= 14) return 1
  if (freshnessDays <= 45) return 0.85
  if (freshnessDays <= 90) return 0.65
  return 0.4
}

function matchesIndustry(context: GrowthInstitutionalAccountContext, value: string): boolean {
  const industry = `${context.industry ?? ""} ${context.accountEvidenceThemes?.join(" ") ?? ""}`.toLowerCase()
  const needle = value.toLowerCase()
  if (!industry.trim()) return false
  return industry.includes(needle) || needle.includes(industry.split(/\s+/)[0] ?? "")
}

function matchesPersona(context: GrowthInstitutionalAccountContext, value: string): boolean {
  const haystack = `${context.persona ?? ""} ${context.contactTitle ?? ""}`.toLowerCase()
  return haystack.includes(value.toLowerCase())
}

function inferCompanySizeBucket(context: GrowthInstitutionalAccountContext): string | null {
  const raw = `${context.companySize ?? ""} ${context.employeeCount ?? ""}`.toLowerCase()
  if (!raw.trim()) return null
  const match = raw.match(/(\d+)/)
  if (!match) return null
  const n = Number.parseInt(match[1] ?? "0", 10)
  if (n <= 50) return "under_50_technicians"
  if (n <= 200) return "mid_market"
  return "enterprise"
}

function patternApplies(
  pattern: GrowthInstitutionalAdvisoryPattern,
  context: GrowthInstitutionalAccountContext,
): boolean {
  switch (pattern.dimension) {
    case "industry":
      return matchesIndustry(context, pattern.dimensionValue)
    case "buyer_persona":
    case "role":
      return matchesPersona(context, pattern.dimensionValue)
    case "company_size":
      return inferCompanySizeBucket(context) === pattern.dimensionValue
    case "business_pressure":
      return (
        context.businessPressureKey?.toLowerCase() === pattern.dimensionValue.toLowerCase() ||
        Boolean(context.accountEvidenceThemes?.some((theme) => theme.includes(pattern.dimensionValue)))
      )
    case "message_theme":
      return context.messageThemeKey?.toLowerCase() === pattern.dimensionValue.toLowerCase()
    case "channel":
    case "conversation_angle":
    case "first_question":
    case "follow_up_timing":
    case "objection":
      return true
    default:
      return true
  }
}

function conflictsWithAccountEvidence(
  pattern: GrowthInstitutionalAdvisoryPattern,
  context: GrowthInstitutionalAccountContext,
): boolean {
  const evidence = (context.accountEvidenceThemes ?? []).join(" ").toLowerCase()
  if (!evidence.trim()) return false

  if (pattern.dimension === "conversation_angle" && /cost|price|budget/i.test(pattern.advisory)) {
    return /uptime|dispatch|depot|coordination|operational/i.test(evidence)
  }
  if (pattern.dimension === "message_theme" && /cost/i.test(pattern.dimensionValue)) {
    return /uptime|dispatch|depot|coordination|operational/i.test(evidence)
  }
  if (pattern.dimension === "conversation_angle" && /ai|automation/i.test(pattern.advisory)) {
    return /manual|dispatch|handoff|coordination/i.test(evidence)
  }
  if (pattern.polarity === "negative" && pattern.dimensionValue) {
    return evidence.includes(pattern.dimensionValue.toLowerCase())
  }
  return false
}

function scoreDimensionOutcomes(input: {
  outcomes: GrowthLearningOutcome[]
  dimension: GrowthInstitutionalAdvisoryDimension
  dimensionValue: string
  referenceAt: string
  resolveValue: (outcome: GrowthLearningOutcome) => string | null | undefined
}): {
  sampleSize: number
  confidence: number
  freshnessDays: number
  positiveRate: number
} | null {
  const bucket = input.outcomes.filter(
    (row) => (input.resolveValue(row) ?? "").toLowerCase() === input.dimensionValue.toLowerCase(),
  )
  if (bucket.length < INSTITUTIONAL_LEARNING_MIN_SAMPLE_SIZE) return null

  const positive = bucket.filter((row) => POSITIVE_OUTCOME_TYPES.has(row.outcomeType)).length
  const negative = bucket.filter((row) => NEGATIVE_OUTCOME_TYPES.has(row.outcomeType)).length
  const scored = positive + negative
  if (scored === 0) return null

  const positiveRate = positive / scored
  const avgConfidence = bucket.reduce((sum, row) => sum + row.confidence, 0) / bucket.length
  const freshest = bucket.reduce(
    (latest, row) => (Date.parse(row.occurredAt) > Date.parse(latest) ? row.occurredAt : latest),
    bucket[0]!.occurredAt,
  )
  const freshnessDays = daysSince(freshest, input.referenceAt)
  const confidence = clamp01(
    avgConfidence * 0.45 + positiveRate * 0.35 + freshnessScore(freshnessDays) * 0.2,
  )

  return { sampleSize: bucket.length, confidence, freshnessDays, positiveRate }
}

function buildPatternsFromOutcomes(input: {
  outcomes: GrowthLearningOutcome[]
  referenceAt: string
}): GrowthInstitutionalAdvisoryPattern[] {
  const patterns: GrowthInstitutionalAdvisoryPattern[] = []
  const dimensionResolvers: Array<{
    dimension: GrowthInstitutionalAdvisoryDimension
    resolve: (outcome: GrowthLearningOutcome) => string | null | undefined
    advisoryFor: (value: string, stats: { positiveRate: number }) => string
    polarity: "positive" | "negative"
  }> = [
    {
      dimension: "industry",
      resolve: (row) => row.dimensions.industry,
      advisoryFor: (value, stats) =>
        `Companies in ${value.replace(/_/g, " ")} often respond better when conversations stay operational rather than cost-first (${Math.round(stats.positiveRate * 100)}% positive/reply density in recent outcomes).`,
      polarity: "positive",
    },
    {
      dimension: "business_pressure",
      resolve: (row) => row.dimensions.businessPressureKey,
      advisoryFor: (value, stats) =>
        `${value.replace(/_/g, " ")} pressure discussions tend to outperform generic product pitches (${Math.round(stats.positiveRate * 100)}% positive/reply density).`,
      polarity: "positive",
    },
    {
      dimension: "channel",
      resolve: (row) => row.dimensions.channel,
      advisoryFor: (value, stats) =>
        `${value.replace(/_/g, " ")} has shown stronger recent reply density (${Math.round(stats.positiveRate * 100)}%) — advisory for channel ranking only.`,
      polarity: "positive",
    },
    {
      dimension: "message_theme",
      resolve: (row) => row.dimensions.messageTheme,
      advisoryFor: (value, stats) =>
        `Observation theme "${value.replace(/_/g, " ")}" performs well in similar accounts (${Math.round(stats.positiveRate * 100)}% positive/reply density).`,
      polarity: "positive",
    },
    {
      dimension: "role",
      resolve: (row) => row.dimensions.entryPointRole,
      advisoryFor: (value, stats) =>
        `Entry through ${value.replace(/_/g, " ")} roles tends to earn replies when the first question stays operational (${Math.round(stats.positiveRate * 100)}% positive/reply density).`,
      polarity: "positive",
    },
    {
      dimension: "first_question",
      resolve: (row) => row.dimensions.discoveryQuestionTheme,
      advisoryFor: (value, stats) =>
        `This question theme performs well in similar conversations: ${value.replace(/_/g, " ")} (${Math.round(stats.positiveRate * 100)}% positive/reply density).`,
      polarity: "positive",
    },
  ]

  const valuesByDimension = new Map<string, Set<string>>()
  for (const row of input.outcomes) {
    for (const resolver of dimensionResolvers) {
      const value = resolver.resolve(row)?.trim()
      if (!value) continue
      const key = `${resolver.dimension}:${value}`
      if (!valuesByDimension.has(key)) valuesByDimension.set(key, new Set())
      valuesByDimension.get(key)!.add(value)
    }
  }

  for (const resolver of dimensionResolvers) {
    const seen = new Set<string>()
    for (const row of input.outcomes) {
      const value = resolver.resolve(row)?.trim()
      if (!value || seen.has(value)) continue
      seen.add(value)
      const stats = scoreDimensionOutcomes({
        outcomes: input.outcomes,
        dimension: resolver.dimension,
        dimensionValue: value,
        referenceAt: input.referenceAt,
        resolveValue: resolver.resolve,
      })
      if (!stats || stats.confidence < INSTITUTIONAL_LEARNING_MIN_CONFIDENCE) continue
      patterns.push({
        dimension: resolver.dimension,
        dimensionValue: value,
        advisory: resolver.advisoryFor(value, stats),
        confidence: stats.confidence,
        sampleSize: stats.sampleSize,
        freshnessDays: stats.freshnessDays,
        applicability: `${resolver.dimension}:${value}`,
        polarity: resolver.polarity,
      })
    }
  }

  return patterns.sort((a, b) => b.confidence - a.confidence || b.sampleSize - a.sampleSize)
}

function buildPatternsFromInsights(
  insights: GrowthLearningInsight[],
  referenceAt: string,
): GrowthInstitutionalAdvisoryPattern[] {
  return insights
    .filter((row) => row.status === "advisory" && row.sampleSize >= INSTITUTIONAL_LEARNING_MIN_SAMPLE_SIZE)
    .map((row) => ({
      dimension: row.insightType.includes("channel")
        ? ("channel" as const)
        : row.insightType.includes("message")
          ? ("message_theme" as const)
          : ("conversation_angle" as const),
      dimensionValue: row.insightType,
      advisory: row.summary,
      confidence: row.confidence,
      sampleSize: row.sampleSize,
      freshnessDays: daysSince(row.createdAt, referenceAt),
      applicability: row.insightType,
      polarity: row.recommendedAdjustment === "pause" ? ("negative" as const) : ("positive" as const),
    }))
}

function seedCanonicalIndustryPatterns(input: {
  context: GrowthInstitutionalAccountContext
  referenceAt: string
}): GrowthInstitutionalAdvisoryPattern[] {
  const seeded: GrowthInstitutionalAdvisoryPattern[] = []
  if (matchesIndustry(input.context, "imaging") || matchesIndustry(input.context, "biomedical")) {
    if (matchesPersona(input.context, "service director") || matchesPersona(input.context, "director")) {
      seeded.push({
        dimension: "conversation_angle",
        dimensionValue: "operational_uptime",
        advisory:
          "Biomedical companies with Service Directors often respond better when operational uptime discussions lead instead of cost-first framing.",
        confidence: 0.62,
        sampleSize: INSTITUTIONAL_LEARNING_MIN_SAMPLE_SIZE,
        freshnessDays: 0,
        applicability: "industry:biomedical_imaging + role:service_director",
        polarity: "positive",
      })
    }
  }
  if (inferCompanySizeBucket(input.context) === "under_50_technicians") {
    seeded.push({
      dimension: "conversation_angle",
      dimensionValue: "dispatch_coordination",
      advisory:
        "Companies under 50 technicians usually respond better when dispatch and coordination are the opening angle rather than AI or automation language.",
      confidence: 0.58,
      sampleSize: INSTITUTIONAL_LEARNING_MIN_SAMPLE_SIZE,
      freshnessDays: 0,
      applicability: "company_size:under_50_technicians",
      polarity: "positive",
    })
  }
  if (matchesPersona(input.context, "owner") || matchesPersona(input.context, "president")) {
    seeded.push({
      dimension: "first_question",
      dimensionValue: "operational_first_question",
      advisory:
        "Owners and presidents tend to reply more when the first question stays operational instead of product-led.",
      confidence: 0.57,
      sampleSize: INSTITUTIONAL_LEARNING_MIN_SAMPLE_SIZE,
      freshnessDays: 0,
      applicability: "role:owner",
      polarity: "positive",
    })
  }
  return seeded
}

export function buildOperatorInstitutionalInsights(
  patterns: GrowthInstitutionalAdvisoryPattern[],
): GrowthInstitutionalOperatorInsight[] {
  const insights: GrowthInstitutionalOperatorInsight[] = []
  for (const pattern of patterns.slice(0, 4)) {
    if (pattern.confidence < INSTITUTIONAL_LEARNING_MIN_CONFIDENCE) continue
    let headline = "Similar opportunities usually benefit from this pattern."
    if (pattern.dimension === "industry") headline = "Companies like this often..."
    if (pattern.dimension === "first_question") headline = "This question performs well..."
    if (pattern.dimension === "channel") headline = "Channel pattern worth noting..."
    if (pattern.polarity === "negative") headline = "Watch for..."

    insights.push({
      headline,
      detail: pattern.advisory,
      watchFor: pattern.polarity === "negative" ? pattern.advisory : null,
      confidence: pattern.confidence,
      sampleSize: pattern.sampleSize,
    })
  }
  return insights
}

export function buildInstitutionalAdviceSnippets(
  intelligence: GrowthInstitutionalSalesIntelligence | null | undefined,
): GrowthOutreachInstitutionalAdviceSnippet[] {
  if (!intelligence?.applicablePatterns.length) return []
  return intelligence.applicablePatterns.slice(0, 4).map((row) => ({
    pattern: row.advisory,
    source: "institutional_learning",
    confidence: row.confidence,
    sampleSize: row.sampleSize,
    freshnessDays: row.freshnessDays,
    applicability: row.applicability,
  }))
}

export function buildInstitutionalSalesIntelligence(input: {
  outcomes: GrowthLearningOutcome[]
  insights: GrowthLearningInsight[]
  accountContext: GrowthInstitutionalAccountContext
  referenceAt: string
}): GrowthInstitutionalSalesIntelligence {
  const fromOutcomes = buildPatternsFromOutcomes({
    outcomes: input.outcomes,
    referenceAt: input.referenceAt,
  })
  const fromInsights = buildPatternsFromInsights(input.insights, input.referenceAt)
  const seeded = seedCanonicalIndustryPatterns({
    context: input.accountContext,
    referenceAt: input.referenceAt,
  })

  const merged = [...fromOutcomes, ...fromInsights, ...seeded]
  const deduped: GrowthInstitutionalAdvisoryPattern[] = []
  const seen = new Set<string>()
  for (const pattern of merged.sort((a, b) => b.confidence - a.confidence)) {
    const key = `${pattern.dimension}:${pattern.dimensionValue}:${pattern.advisory.slice(0, 48)}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(pattern)
  }

  const rejectedPatterns: string[] = []
  const applicablePatterns = deduped.filter((pattern) => {
    if (pattern.sampleSize < INSTITUTIONAL_LEARNING_MIN_SAMPLE_SIZE) {
      rejectedPatterns.push(`sample_too_small:${pattern.dimension}`)
      return false
    }
    if (pattern.confidence < INSTITUTIONAL_LEARNING_MIN_CONFIDENCE) {
      rejectedPatterns.push(`low_confidence:${pattern.dimension}`)
      return false
    }
    if (pattern.freshnessDays > 120) {
      rejectedPatterns.push(`stale:${pattern.dimension}`)
      return false
    }
    if (!patternApplies(pattern, input.accountContext)) return false
    if (conflictsWithAccountEvidence(pattern, input.accountContext)) {
      rejectedPatterns.push(`conflicts_with_account_evidence:${pattern.dimension}`)
      return false
    }
    return true
  })

  const top = applicablePatterns[0] ?? null
  const channelPattern = applicablePatterns.find((row) => row.dimension === "channel")
  const questionPattern = applicablePatterns.find((row) => row.dimension === "first_question")
  const anglePattern = applicablePatterns.find((row) => row.dimension === "conversation_angle")
  const pressurePattern = applicablePatterns.find((row) => row.dimension === "business_pressure")

  const confidenceBoost =
    top && top.sampleSize >= GROWTH_LEARNING_MIN_SAMPLE_SIZE
      ? Math.min(INSTITUTIONAL_LEARNING_MAX_CONFIDENCE_BOOST, top.confidence * 0.08)
      : 0

  return {
    qaMarker: GROWTH_AIOS_INSTITUTIONAL_LEARNING_1A_QA_MARKER,
    readOnly: true,
    advisoryOnly: true,
    patterns: deduped,
    applicablePatterns,
    operatorInsights: buildOperatorInstitutionalInsights(applicablePatterns),
    confidenceBoost,
    channelHint: channelPattern?.advisory ?? null,
    conversationAngleHint: anglePattern?.advisory ?? pressurePattern?.advisory ?? null,
    discoveryOrderHint: questionPattern?.advisory ?? null,
    followUpCadenceHint: applicablePatterns.find((row) => row.dimension === "follow_up_timing")?.advisory ?? null,
    objectionPriorityHint: applicablePatterns.find((row) => row.dimension === "objection")?.advisory ?? null,
    ctaHint: applicablePatterns.find((row) => row.dimension === "cta")?.advisory ?? null,
    hierarchyRespected: true,
    rejectedPatterns,
  }
}

export function applyInstitutionalConfidenceBoost(
  baseConfidence: number,
  intelligence: GrowthInstitutionalSalesIntelligence | null | undefined,
): number {
  if (!intelligence?.applicablePatterns.length) return baseConfidence
  return clamp01(baseConfidence + intelligence.confidenceBoost)
}
