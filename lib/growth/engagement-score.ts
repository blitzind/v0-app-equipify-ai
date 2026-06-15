import {
  applyEngagementIdlePenalty,
  decayEngagementSignalPoints,
  daysSince,
  isEngagementDormant,
} from "@/lib/growth/engagement-decay"
import type {
  GrowthEngagementSignalKind,
  GrowthEngagementTier,
  GrowthEngagementTopSignal,
  GrowthLeadEngagementInput,
  GrowthLeadEngagementResult,
} from "@/lib/growth/engagement-types"

const TERMINAL_STATUSES = new Set(["converted", "disqualified", "archived"])
const POSITIVE_KINDS = new Set<GrowthEngagementSignalKind>([
  "email_open",
  "email_click",
  "email_reply",
  "positive_reply",
  "call_connected",
  "manual_touch",
  "follow_up_completed",
  "decision_maker_confirmed",
  "research_completed",
  "share_page_view",
  "share_page_engaged",
  "share_page_cta_click",
  "share_page_booking_completed",
])

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

export function tierFromEngagementScore(score: number, isSuppressed: boolean): GrowthEngagementTier {
  if (isSuppressed) return "cold"
  if (score >= 75) return "hot"
  if (score >= 50) return "engaged"
  if (score >= 25) return "warming"
  return "cold"
}

export function computeGrowthLeadEngagementScore(input: GrowthLeadEngagementInput): GrowthLeadEngagementResult {
  const now = input.now ?? new Date()

  if (TERMINAL_STATUSES.has(input.status)) {
    return {
      score: 0,
      tier: "cold",
      lastActivityAt: null,
      summary: "Terminal lead status.",
      topSignals: [],
      isDormant: false,
    }
  }

  const contributions: GrowthEngagementTopSignal[] = []
  let lastActivityAt: string | null = null
  let lastPositiveActivityAt: string | null = null

  for (const signal of input.signals) {
    const decayedPoints = decayEngagementSignalPoints(signal.kind, signal.occurredAt, now)
    contributions.push({
      kind: signal.kind,
      label: signal.label,
      decayedPoints: Math.round(decayedPoints * 10) / 10,
      occurredAt: signal.occurredAt,
    })

    if (!lastActivityAt || Date.parse(signal.occurredAt) > Date.parse(lastActivityAt)) {
      lastActivityAt = signal.occurredAt
    }
    if (POSITIVE_KINDS.has(signal.kind)) {
      if (!lastPositiveActivityAt || Date.parse(signal.occurredAt) > Date.parse(lastPositiveActivityAt)) {
        lastPositiveActivityAt = signal.occurredAt
      }
    }
  }

  let score = 25
  score += contributions.reduce((sum, entry) => sum + entry.decayedPoints, 0)
  score = applyEngagementIdlePenalty(score, lastPositiveActivityAt, input.dormancyExemptUntil, now)

  if (input.isSuppressed || input.signals.some((s) => s.kind === "suppression")) {
    score = Math.min(score, 10)
  }
  if (input.signals.some((s) => s.kind === "unsubscribe")) {
    score = Math.min(score, 20)
  }

  score = clampScore(score)
  const tier = tierFromEngagementScore(score, input.isSuppressed)
  const topSignals = [...contributions]
    .sort((a, b) => Math.abs(b.decayedPoints) - Math.abs(a.decayedPoints))
    .slice(0, 3)

  const summaryParts = topSignals
    .filter((entry) => Math.abs(entry.decayedPoints) >= 1)
    .map((entry) => `${entry.label} (${entry.decayedPoints > 0 ? "+" : ""}${Math.round(entry.decayedPoints)})`)

  const summary =
    summaryParts.length > 0
      ? summaryParts.join("; ")
      : lastPositiveActivityAt
        ? `Last activity ${Math.round(daysSince(lastPositiveActivityAt, now))}d ago`
        : "No engagement signals yet"

  return {
    score,
    tier,
    lastActivityAt,
    summary,
    topSignals,
    isDormant: isEngagementDormant(lastActivityAt, input.dormancyExemptUntil, now),
  }
}
