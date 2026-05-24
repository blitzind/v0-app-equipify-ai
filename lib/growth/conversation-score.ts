import type {
  GrowthConversationObjectionKey,
  GrowthConversationObjectionProfile,
  GrowthConversationTopSignal,
  GrowthLeadConversationInput,
  GrowthLeadConversationResult,
} from "@/lib/growth/conversation-types"
import {
  GROWTH_CONVERSATION_OBJECTION_KEYS,
  GROWTH_CONVERSATION_OBJECTION_SEVERITY,
} from "@/lib/growth/conversation-types"
import { computeGrowthConversationBuyingIntent } from "@/lib/growth/conversation-buying-intent"
import { computeGrowthConversationCompetitorPressure } from "@/lib/growth/conversation-competitors"
import { computeGrowthConversationMomentum } from "@/lib/growth/conversation-momentum"
import { computeGrowthConversationResponsePattern } from "@/lib/growth/conversation-response-pattern"
import { computeGrowthConversationSentiment } from "@/lib/growth/conversation-sentiment"
import { computeGrowthConversationUrgency } from "@/lib/growth/conversation-urgency"

function tierFromScore(score: number): GrowthLeadConversationResult["tier"] {
  if (score <= 20) return "critical"
  if (score <= 40) return "cold"
  if (score <= 60) return "neutral"
  if (score <= 80) return "positive"
  return "strong"
}

function trendFromDelta(
  score: number,
  previousScore: number | null,
): GrowthLeadConversationResult["trend"] {
  if (previousScore == null) return "stable"
  const delta = score - previousScore
  if (delta >= 8) return "improving"
  if (delta <= -12) return "at_risk"
  if (delta <= -5) return "cooling"
  return "stable"
}

function buildObjectionProfile(input: GrowthLeadConversationInput): GrowthConversationObjectionProfile {
  const counts = new Map<GrowthConversationObjectionKey, { count: number; lastAt: string | null }>()

  for (const signal of input.signals) {
    if (!signal.kind.startsWith("objection_")) continue
    const rawKey = signal.kind.replace("objection_", "")
    if (!GROWTH_CONVERSATION_OBJECTION_KEYS.includes(rawKey as GrowthConversationObjectionKey)) continue
    const key = rawKey as GrowthConversationObjectionKey
    const existing = counts.get(key) ?? { count: 0, lastAt: null }
    existing.count += 1
    if (!existing.lastAt || Date.parse(signal.occurredAt) > Date.parse(existing.lastAt)) {
      existing.lastAt = signal.occurredAt
    }
    counts.set(key, existing)
  }

  const clusters = [...counts.entries()].map(([key, meta]) => ({
    key,
    count: meta.count,
    severityWeight: GROWTH_CONVERSATION_OBJECTION_SEVERITY[key],
    lastAt: meta.lastAt,
  }))

  const totalSeverityScore = clusters.reduce(
    (sum, cluster) => sum + cluster.severityWeight * cluster.count,
    0,
  )

  return { clusters, totalSeverityScore }
}

function buildSummary(result: Omit<GrowthLeadConversationResult, "summary">): string {
  const parts: string[] = []
  parts.push(`${result.tier} conversation health (${result.score})`)
  if (result.buyingIntent !== "none" && result.buyingIntent !== "weak") {
    parts.push(`${result.buyingIntent} buying intent`)
  }
  if (result.urgencyLevel === "high" || result.urgencyLevel === "critical") {
    parts.push(`${result.urgencyLevel} urgency`)
  }
  if (result.sentiment === "negative" || result.sentiment === "mixed") {
    parts.push(`${result.sentiment} sentiment`)
  }
  if (result.competitorPressure >= 40) {
    parts.push("competitive pressure")
  }
  if (result.momentum === "stalling" || result.momentum === "recovering") {
    parts.push(result.momentum)
  }
  return parts.join(" · ")
}

export function computeGrowthLeadConversationIntelligence(
  input: GrowthLeadConversationInput,
): GrowthLeadConversationResult {
  const now = input.now ?? new Date()
  let baseScore = 50

  if (input.isSuppressed) baseScore -= 25
  if (input.notInterested) baseScore -= 30

  const recentSignals = input.signals.filter((s) => {
    const ageDays = (now.getTime() - Date.parse(s.occurredAt)) / (24 * 60 * 60 * 1000)
    return ageDays <= 90
  })

  for (const signal of recentSignals) {
    const ageDays = (now.getTime() - Date.parse(signal.occurredAt)) / (24 * 60 * 60 * 1000)
    const decay = ageDays <= 7 ? 1 : ageDays <= 30 ? 0.75 : ageDays <= 60 ? 0.5 : 0.25
    baseScore += signal.points * decay
  }

  const objectionProfile = buildObjectionProfile(input)
  baseScore -= Math.min(35, objectionProfile.totalSeverityScore * 0.8)

  const score = Math.max(0, Math.min(100, Math.round(baseScore)))
  const tier = tierFromScore(score)
  const trend = trendFromDelta(score, input.previousScore)

  const topSignals: GrowthConversationTopSignal[] = [...recentSignals]
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
    .slice(0, 5)
    .map((s) => ({
      kind: s.kind,
      label: s.label,
      points: s.points,
      occurredAt: s.occurredAt,
      source: s.source,
    }))

  const sentiment = computeGrowthConversationSentiment(input)
  const urgencyLevel = computeGrowthConversationUrgency(input)
  const buyingIntent = computeGrowthConversationBuyingIntent(input)
  const { mentions, pressure: competitorPressure } = computeGrowthConversationCompetitorPressure(input)
  const responsePattern = computeGrowthConversationResponsePattern(input)
  const momentum = computeGrowthConversationMomentum(input, score, trend)

  const meaningful = input.signals
    .filter((s) => s.points >= 8 || s.points <= -8)
    .map((s) => s.occurredAt)
  const lastMeaningfulConversationAt =
    meaningful.length > 0
      ? meaningful.sort((a, b) => Date.parse(b) - Date.parse(a))[0]!
      : null

  const signalCount = recentSignals.length
  const confidence = Math.max(
    20,
    Math.min(100, 35 + signalCount * 8 + (input.replyLatenciesMs.length > 0 ? 10 : 0)),
  )

  const partial: Omit<GrowthLeadConversationResult, "summary"> = {
    score,
    tier,
    topSignals,
    sentiment,
    urgencyLevel,
    buyingIntent,
    objectionProfile,
    competitorMentions: mentions,
    competitorPressure,
    lastMeaningfulConversationAt,
    trend,
    confidence,
    momentum,
    responsePattern,
  }

  return {
    ...partial,
    summary: buildSummary(partial),
  }
}
