import { daysSince } from "@/lib/growth/engagement-decay"
import type { GrowthEngagementTier } from "@/lib/growth/engagement-types"
import {
  HIGH_VALUE_RELATIONSHIP_KINDS,
  isMeaningfulRelationshipTouch,
  relationshipSignalPoints,
} from "@/lib/growth/relationship-meaningful-touch"
import { computeRelationshipTrend } from "@/lib/growth/relationship-trend"
import type {
  GrowthLeadRelationshipInput,
  GrowthLeadRelationshipResult,
  GrowthRelationshipOwnerAttentionLevel,
  GrowthRelationshipSignal,
  GrowthRelationshipSignalKind,
  GrowthRelationshipTier,
  GrowthRelationshipTopSignal,
  GrowthRelationshipTrend,
} from "@/lib/growth/relationship-types"

const TERMINAL_STATUSES = new Set(["converted", "disqualified", "archived"])
const STRATEGIC_SCORE_THRESHOLD = 85
const TRUSTED_SCORE_THRESHOLD = 65
const ACTIVE_SCORE_THRESHOLD = 40
const DEVELOPING_SCORE_THRESHOLD = 15
const HIGH_VALUE_LOOKBACK_DAYS = 90
const STRATEGIC_SILENCE_PENALTY_FACTOR = 0.5

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function countHighValueSignals(signals: GrowthRelationshipSignal[], now: Date): number {
  const cutoff = now.getTime() - HIGH_VALUE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  const kinds = new Set<GrowthRelationshipSignalKind>()
  for (const signal of signals) {
    if (!HIGH_VALUE_RELATIONSHIP_KINDS.has(signal.kind)) continue
    if (Date.parse(signal.occurredAt) < cutoff) continue
    kinds.add(signal.kind)
  }
  return kinds.size
}

function tierFromScore(
  score: number,
  meaningfulTouchCount: number,
  highValueCount: number,
  isSuppressed: boolean,
): GrowthRelationshipTier {
  if (isSuppressed) return score >= DEVELOPING_SCORE_THRESHOLD ? "developing" : "unknown"
  if (meaningfulTouchCount === 0 || score < DEVELOPING_SCORE_THRESHOLD) return "unknown"
  if (score >= STRATEGIC_SCORE_THRESHOLD && highValueCount >= 2) return "strategic"
  if (score >= TRUSTED_SCORE_THRESHOLD) return "trusted"
  if (score >= ACTIVE_SCORE_THRESHOLD) return "active"
  return "developing"
}

function computeSilencePenalty(
  lastMeaningfulTouchAt: string | null,
  now: Date,
  strategicProtection: boolean,
): { penalty: number; signal: GrowthRelationshipTopSignal | null } {
  if (!lastMeaningfulTouchAt) {
    return { penalty: 0, signal: null }
  }

  const idleDays = daysSince(lastMeaningfulTouchAt, now)
  let penalty = 0
  if (idleDays > 60) penalty = -25
  else if (idleDays > 30) penalty = -10

  if (penalty === 0) {
    return { penalty: 0, signal: null }
  }

  if (strategicProtection) {
    penalty = Math.round(penalty * STRATEGIC_SILENCE_PENALTY_FACTOR)
  }

  return {
    penalty,
    signal: {
      kind: "long_silence",
      label: strategicProtection
        ? `Long silence (${Math.round(idleDays)}d, strategic protection applied)`
        : `Long silence (${Math.round(idleDays)}d)`,
      points: penalty,
      occurredAt: lastMeaningfulTouchAt,
    },
  }
}

export function computeRelationshipOwnerAttentionLevel(input: {
  tier: GrowthRelationshipTier
  trend: GrowthRelationshipTrend
  fit: number | null
  engagementTier: GrowthEngagementTier | null
}): GrowthRelationshipOwnerAttentionLevel {
  const fit = input.fit ?? 0

  if (
    input.tier === "strategic" &&
    input.engagementTier === "hot" &&
    fit > 85
  ) {
    return "critical"
  }

  if (input.tier === "strategic" && input.engagementTier === "hot") {
    return "important"
  }

  if (input.tier === "strategic" && fit > 80) {
    return "important"
  }

  if (input.tier === "trusted" && fit > 80) {
    return "recommended"
  }

  if (
    input.trend === "cooling" &&
    fit > 75 &&
    (input.tier === "trusted" || input.tier === "strategic")
  ) {
    return "recommended"
  }

  return "none"
}

export function computeGrowthLeadRelationshipStrength(
  input: GrowthLeadRelationshipInput,
): GrowthLeadRelationshipResult {
  const now = input.now ?? new Date()

  if (TERMINAL_STATUSES.has(input.status)) {
    return {
      score: 0,
      tier: "unknown",
      lastMeaningfulTouchAt: null,
      summary: "Terminal lead status.",
      topSignals: [],
      trend: "stable",
      ownerAttentionLevel: "none",
    }
  }

  const contributions: GrowthRelationshipTopSignal[] = []
  let lastMeaningfulTouchAt: string | null = null

  for (const signal of input.signals) {
    if (signal.kind === "long_silence") continue
    const points = relationshipSignalPoints(signal.kind)
    contributions.push({
      kind: signal.kind,
      label: signal.label,
      points,
      occurredAt: signal.occurredAt,
    })

    if (isMeaningfulRelationshipTouch(signal.kind) || signal.isMeaningfulTouch) {
      if (
        !lastMeaningfulTouchAt ||
        Date.parse(signal.occurredAt) > Date.parse(lastMeaningfulTouchAt)
      ) {
        lastMeaningfulTouchAt = signal.occurredAt
      }
    }
  }

  const meaningfulTouchCount = contributions.filter(
    (entry) => isMeaningfulRelationshipTouch(entry.kind) && entry.points > 0,
  ).length

  let score = 10
  score += contributions.reduce((sum, entry) => sum + entry.points, 0)

  const highValueCount = countHighValueSignals(input.signals, now)
  const preliminaryTier = tierFromScore(
    clampScore(score),
    meaningfulTouchCount,
    highValueCount,
    input.isSuppressed,
  )

  const strategicProtection =
    input.previousTier === "strategic" || preliminaryTier === "strategic"

  const silence = computeSilencePenalty(lastMeaningfulTouchAt, now, strategicProtection)
  if (silence.signal) {
    contributions.push(silence.signal)
    score += silence.penalty
  }

  if (input.isSuppressed || input.signals.some((s) => s.kind === "suppression")) {
    score = Math.min(score, 15)
  }
  if (input.signals.some((s) => s.kind === "unsubscribe")) {
    score = Math.min(score, 20)
  }

  score = clampScore(score)
  const tier = tierFromScore(score, meaningfulTouchCount, highValueCount, input.isSuppressed)

  const topSignals = [...contributions]
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
    .slice(0, 3)

  const trend = computeRelationshipTrend({
    previousScore: input.previousScore,
    currentScore: score,
    previousTrend: input.previousTrend,
    tier,
    lastMeaningfulTouchAt,
    now,
  })

  const ownerAttentionLevel = computeRelationshipOwnerAttentionLevel({
    tier,
    trend,
    fit: input.fit,
    engagementTier: input.engagementTier,
  })

  const summaryParts = topSignals
    .filter((entry) => Math.abs(entry.points) >= 1)
    .map((entry) => `${entry.label} (${entry.points > 0 ? "+" : ""}${entry.points})`)

  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1)
  const summary =
    summaryParts.length > 0
      ? `${tierLabel} relationship — ${summaryParts.join("; ")}`
      : lastMeaningfulTouchAt
        ? `${tierLabel} relationship — last meaningful touch ${Math.round(daysSince(lastMeaningfulTouchAt, now))}d ago`
        : `${tierLabel} relationship — no meaningful touches yet`

  return {
    score,
    tier,
    lastMeaningfulTouchAt,
    summary,
    topSignals,
    trend,
    ownerAttentionLevel,
  }
}
