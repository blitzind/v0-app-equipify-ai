/**
 * GE-AIOS-INSTITUTIONAL-LEARNING-1B — Institutional learning refinement (client-safe).
 * Extends Learning Engine patterns — advisory only; preserves canonical identity in copy.
 */

import type {
  GrowthLearningInsight,
  GrowthLearningOutcome,
} from "@/lib/growth/aios/learning/growth-closed-loop-learning-types"
import {
  INSTITUTIONAL_LEARNING_MIN_CONFIDENCE,
  INSTITUTIONAL_LEARNING_MIN_SAMPLE_SIZE,
  type GrowthInstitutionalAccountContext,
  type GrowthInstitutionalAdvisoryDimension,
  type GrowthInstitutionalAdvisoryPattern,
  type GrowthInstitutionalSalesIntelligence,
} from "@/lib/growth/aios/growth/growth-institutional-learning-1a-types"
import type { GrowthCanonicalDisplayIdentity } from "@/lib/growth/aios/growth/growth-canonical-display-identity-1b-types"
import { resolveAuthoritativeForm } from "@/lib/growth/aios/growth/growth-canonical-display-identity-1b"
import { GROWTH_AIOS_INSTITUTIONAL_LEARNING_1B_QA_MARKER } from "@/lib/growth/aios/growth/growth-institutional-learning-1b-types"

export { GROWTH_AIOS_INSTITUTIONAL_LEARNING_1B_QA_MARKER } from "@/lib/growth/aios/growth/growth-institutional-learning-1b-types"

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

function scoreDimensionOutcomes(input: {
  outcomes: GrowthLearningOutcome[]
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

function resolveObjectionTheme(outcome: GrowthLearningOutcome): string | null {
  const fromEvidence = outcome.evidence.find((row) => /objection/i.test(row.label))?.value
  if (fromEvidence) return String(fromEvidence).trim()
  if (outcome.outcomeType === "negative_intent") return "negative_intent"
  return null
}

function resolveMeetingOutcome(outcome: GrowthLearningOutcome): string | null {
  if (outcome.outcomeType === "meeting_booked") return "meeting_booked"
  if (outcome.source === "meeting" && outcome.outcomeType === "no_response") return "meeting_no_show"
  if (outcome.source === "meeting" && outcome.outcomeType === "positive_intent") return "meeting_positive"
  return null
}

function resolveProposalOutcome(outcome: GrowthLearningOutcome): string | null {
  if (outcome.outcomeType === "converted") return "proposal_won"
  if (outcome.outcomeType === "rejected") return "proposal_lost"
  if (outcome.outcomeType === "stalled" && outcome.source === "revenue_director") return "proposal_stalled"
  return null
}

function buildExtendedPatternsFromOutcomes(input: {
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
      dimension: "follow_up_timing",
      resolve: (row) => row.dimensions.timingBucket,
      advisoryFor: (value, stats) =>
        `Follow-up timing bucket "${value.replace(/_/g, " ")}" shows stronger engagement when cadence stays respectful (${Math.round(stats.positiveRate * 100)}% positive/reply density).`,
      polarity: "positive",
    },
    {
      dimension: "objection",
      resolve: resolveObjectionTheme,
      advisoryFor: (value, stats) =>
        `Objection theme "${value.replace(/_/g, " ")}" responds better to operational proof before pricing (${Math.round(stats.positiveRate * 100)}% positive/reply density).`,
      polarity: "positive",
    },
    {
      dimension: "meeting_outcome",
      resolve: resolveMeetingOutcome,
      advisoryFor: (value, stats) =>
        `Meeting outcome pattern "${value.replace(/_/g, " ")}" suggests tightening pre-meeting discovery (${Math.round(stats.positiveRate * 100)}% positive density).`,
      polarity: "positive",
    },
    {
      dimension: "proposal_outcome",
      resolve: resolveProposalOutcome,
      advisoryFor: (value, stats) =>
        `Proposal outcome "${value.replace(/_/g, " ")}" correlates with earlier committee validation (${Math.round(stats.positiveRate * 100)}% win/reply density).`,
      polarity: "positive",
    },
    {
      dimension: "buying_committee_shape",
      resolve: (row) => row.dimensions.committeeStrategy,
      advisoryFor: (value, stats) =>
        `Buying committee shape "${value.replace(/_/g, " ")}" benefits from multi-thread validation before proposal (${Math.round(stats.positiveRate * 100)}% positive/reply density).`,
      polarity: "positive",
    },
    {
      dimension: "buyer_persona",
      resolve: (row) => row.dimensions.persona,
      advisoryFor: (value, stats) =>
        `Buyer persona "${value.replace(/_/g, " ")}" tends to engage when discovery stays operational (${Math.round(stats.positiveRate * 100)}% positive/reply density).`,
      polarity: "positive",
    },
    {
      dimension: "company_size",
      resolve: (row) => row.dimensions.companySize,
      advisoryFor: (value, stats) =>
        `Company size band "${value.replace(/_/g, " ")}" responds better to coordination-first messaging (${Math.round(stats.positiveRate * 100)}% positive/reply density).`,
      polarity: "positive",
    },
    {
      dimension: "cta",
      resolve: (row) =>
        row.dimensions.revenueStrategyRecommendation?.includes("cta")
          ? row.dimensions.revenueStrategyRecommendation
          : null,
      advisoryFor: (value, stats) =>
        `CTA posture "${value.replace(/_/g, " ")}" earns replies without feeling pushy (${Math.round(stats.positiveRate * 100)}% positive/reply density).`,
      polarity: "positive",
    },
  ]

  for (const resolver of dimensionResolvers) {
    const seen = new Set<string>()
    for (const row of input.outcomes) {
      const value = resolver.resolve(row)?.trim()
      if (!value || seen.has(value)) continue
      seen.add(value)
      const stats = scoreDimensionOutcomes({
        outcomes: input.outcomes,
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

  return patterns
}

function buildExtendedPatternsFromInsights(
  insights: GrowthLearningInsight[],
  referenceAt: string,
): GrowthInstitutionalAdvisoryPattern[] {
  return insights
    .filter((row) => row.status === "advisory" && row.sampleSize >= INSTITUTIONAL_LEARNING_MIN_SAMPLE_SIZE)
    .flatMap((row) => {
      const dimension: GrowthInstitutionalAdvisoryDimension = row.insightType.includes("timing")
        ? "follow_up_timing"
        : row.insightType.includes("channel")
          ? "channel"
          : row.insightType.includes("message")
            ? "message_theme"
            : row.insightType.includes("qualification")
              ? "objection"
              : "conversation_angle"
      return [
        {
          dimension,
          dimensionValue: row.insightType,
          advisory: row.summary,
          confidence: row.confidence,
          sampleSize: row.sampleSize,
          freshnessDays: daysSince(row.createdAt, referenceAt),
          applicability: row.insightType,
          polarity:
            row.recommendedAdjustment === "pause" ? ("negative" as const) : ("positive" as const),
        },
      ]
    })
}

function refineSeededIndustryPatterns(input: {
  context: GrowthInstitutionalAccountContext
  referenceAt: string
}): GrowthInstitutionalAdvisoryPattern[] {
  const company = resolveAuthoritativeForm(input.context.companyName)
  const seeded: GrowthInstitutionalAdvisoryPattern[] = []
  const industryHaystack =
    `${input.context.industry ?? ""} ${input.context.accountEvidenceThemes?.join(" ") ?? ""}`.toLowerCase()

  if (/imaging|biomedical|diagnostic/.test(industryHaystack)) {
    seeded.push({
      dimension: "conversation_angle",
      dimensionValue: "operational_uptime_imaging",
      advisory: `${company} and similar diagnostic imaging service organizations often respond better when operational uptime discussions lead instead of cost-first framing.`,
      confidence: 0.64,
      sampleSize: INSTITUTIONAL_LEARNING_MIN_SAMPLE_SIZE,
      freshnessDays: 0,
      applicability: `industry:diagnostic_imaging:${company}`,
      polarity: "positive",
    })
  }

  return seeded
}

export function professionalizeInstitutionalAdvisoryText(
  advisory: string,
  context: GrowthInstitutionalAccountContext,
  identity?: GrowthCanonicalDisplayIdentity | null,
): string {
  const company = identity?.company.canonical ?? resolveAuthoritativeForm(context.companyName)
  let out = advisory

  const replacements: Array<[RegExp, string]> = [
    [/\bblock imaging companies\b/gi, `${company} and similar diagnostic imaging service organizations`],
    [/\bblock imaging\b/gi, company],
    [/\bcompanies like this\b/gi, `organizations like ${company}`],
    [/\bcompanies in ([a-z_ ]+)\b/gi, (_match, industry: string) =>
      `Organizations in ${industry.replace(/_/g, " ")} — including ${company}`],
  ]

  for (const [pattern, replacement] of replacements) {
    out = out.replace(pattern, replacement)
  }

  return out
}

export function applyInstitutionalLearning1BRefinements(input: {
  intelligence: GrowthInstitutionalSalesIntelligence
  outcomes: GrowthLearningOutcome[]
  insights: GrowthLearningInsight[]
  accountContext: GrowthInstitutionalAccountContext
  referenceAt: string
  canonicalIdentity?: GrowthCanonicalDisplayIdentity | null
}): GrowthInstitutionalSalesIntelligence {
  const extended = [
    ...buildExtendedPatternsFromOutcomes({
      outcomes: input.outcomes,
      referenceAt: input.referenceAt,
    }),
    ...buildExtendedPatternsFromInsights(input.insights, input.referenceAt),
    ...refineSeededIndustryPatterns({
      context: input.accountContext,
      referenceAt: input.referenceAt,
    }),
  ]

  const professionalize = (pattern: GrowthInstitutionalAdvisoryPattern) => ({
    ...pattern,
    advisory: professionalizeInstitutionalAdvisoryText(
      pattern.advisory,
      input.accountContext,
      input.canonicalIdentity,
    ),
  })

  const mergedPatterns: GrowthInstitutionalAdvisoryPattern[] = []
  const seen = new Set<string>()
  for (const pattern of [...input.intelligence.patterns, ...extended].sort(
    (a, b) => b.confidence - a.confidence || b.sampleSize - a.sampleSize,
  )) {
    const key = `${pattern.dimension}:${pattern.dimensionValue}:${pattern.advisory.slice(0, 48)}`
    if (seen.has(key)) continue
    seen.add(key)
    mergedPatterns.push(professionalize(pattern))
  }

  const applicableKeys = new Set(
    input.intelligence.applicablePatterns.map((row) => `${row.dimension}:${row.dimensionValue}`),
  )
  const applicablePatterns = mergedPatterns.filter((row) => {
    if (applicableKeys.has(`${row.dimension}:${row.dimensionValue}`)) return true
    if (row.confidence < INSTITUTIONAL_LEARNING_MIN_CONFIDENCE) return false
    if (row.sampleSize < INSTITUTIONAL_LEARNING_MIN_SAMPLE_SIZE) return false
    return extended.some(
      (seed) => seed.dimension === row.dimension && seed.dimensionValue === row.dimensionValue,
    )
  })

  const operatorInsights = input.intelligence.operatorInsights.map((row) => ({
    ...row,
    detail: professionalizeInstitutionalAdvisoryText(
      row.detail,
      input.accountContext,
      input.canonicalIdentity,
    ),
  }))

  return {
    ...input.intelligence,
    patterns: mergedPatterns,
    applicablePatterns,
    operatorInsights,
    channelHint:
      applicablePatterns.find((row) => row.dimension === "channel")?.advisory ??
      input.intelligence.channelHint,
    conversationAngleHint:
      applicablePatterns.find((row) => row.dimension === "conversation_angle")?.advisory ??
      input.intelligence.conversationAngleHint,
    discoveryOrderHint:
      applicablePatterns.find((row) => row.dimension === "first_question")?.advisory ??
      input.intelligence.discoveryOrderHint,
    followUpCadenceHint:
      applicablePatterns.find((row) => row.dimension === "follow_up_timing")?.advisory ??
      input.intelligence.followUpCadenceHint,
    objectionPriorityHint:
      applicablePatterns.find((row) => row.dimension === "objection")?.advisory ??
      input.intelligence.objectionPriorityHint,
    ctaHint:
      applicablePatterns.find((row) => row.dimension === "cta")?.advisory ??
      input.intelligence.ctaHint,
    refinementMarker: GROWTH_AIOS_INSTITUTIONAL_LEARNING_1B_QA_MARKER,
  }
}
