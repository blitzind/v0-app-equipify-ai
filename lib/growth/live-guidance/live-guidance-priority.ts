/** Deterministic live guidance prioritization (Sprint 2.1). Client-safe — display only. */

import type {
  GrowthLiveExecutionScore,
  GrowthLiveGuidanceEvent,
  GrowthLiveGuidanceEventType,
  GrowthLiveGuidanceSeverity,
} from "@/lib/growth/live-guidance/live-guidance-types"
import type { GrowthRealtimeLiveSnapshot } from "@/lib/growth/realtime/realtime-call-types"

export const GROWTH_LIVE_COACHING_UX_QA_MARKER = "growth-live-coaching-ux-v1" as const
export const LIVE_COACHING_TOP_GUIDANCE_COUNT = 3

export const GROWTH_LIVE_GUIDANCE_PRIORITY_LABELS = [
  "Critical",
  "High",
  "Medium",
  "Low",
] as const

export type GrowthLiveGuidancePriorityLabel = (typeof GROWTH_LIVE_GUIDANCE_PRIORITY_LABELS)[number]

const EVENT_TYPE_TIER: Partial<Record<GrowthLiveGuidanceEventType, number>> = {
  executive_risk: 4,
  pricing_pressure: 4,
  momentum_drop: 4,
  objection_guidance: 3,
  buying_signal_detected: 3,
  meeting_lock_prompt: 3,
  close_attempt_recommended: 3,
  discovery_gap_guidance: 3,
  competitor_response: 3,
  urgency_detected: 2,
  ask_followup_question: 2,
  talking_too_much: 2,
  silence_recovery: 2,
  relationship_recovery: 1,
}

const SEVERITY_WEIGHT: Record<GrowthLiveGuidanceSeverity, number> = {
  high: 3,
  medium: 2,
  low: 1,
}

function guidanceTier(event: GrowthLiveGuidanceEvent): number {
  return EVENT_TYPE_TIER[event.eventType] ?? (event.severity === "high" ? 3 : event.severity === "medium" ? 2 : 1)
}

export function guidancePriorityScore(event: GrowthLiveGuidanceEvent): number {
  const tier = guidanceTier(event)
  const severity = SEVERITY_WEIGHT[event.severity]
  return tier * 1000 + severity * 100 + event.confidenceScore
}

export function guidancePriorityLabel(event: GrowthLiveGuidanceEvent): GrowthLiveGuidancePriorityLabel {
  const tier = guidanceTier(event)
  if (tier >= 4) return "Critical"
  if (tier >= 3) return "High"
  if (tier >= 2) return "Medium"
  return "Low"
}

export function rankActiveGuidance(events: GrowthLiveGuidanceEvent[]): GrowthLiveGuidanceEvent[] {
  return [...events].sort((a, b) => {
    const scoreDiff = guidancePriorityScore(b) - guidancePriorityScore(a)
    if (scoreDiff !== 0) return scoreDiff
    return b.surfacedAt.localeCompare(a.surfacedAt)
  })
}

export function partitionLiveCoachingGuidance(events: GrowthLiveGuidanceEvent[]): {
  topPriority: GrowthLiveGuidanceEvent[]
  additional: GrowthLiveGuidanceEvent[]
} {
  const ranked = rankActiveGuidance(events)
  return {
    topPriority: ranked.slice(0, LIVE_COACHING_TOP_GUIDANCE_COUNT),
    additional: ranked.slice(LIVE_COACHING_TOP_GUIDANCE_COUNT),
  }
}

export function guidanceConfidenceReasonLines(event: GrowthLiveGuidanceEvent): string[] {
  const lines = [event.supportingReason.trim()].filter(Boolean)
  if (event.operatorPrompt.trim()) lines.push(event.operatorPrompt.trim())
  return [...new Set(lines)].slice(0, 4)
}

export type LiveCoachingExecutionContributor = {
  label: string
  value: string
  emphasis?: boolean
}

export function buildExecutionScoreContributors(input: {
  score: GrowthLiveExecutionScore
  snapshot: Pick<
    GrowthRealtimeLiveSnapshot,
    "talkRatio" | "buyingSignals" | "discovery" | "objections"
  >
}): {
  topContributors: LiveCoachingExecutionContributor[]
  opportunities: LiveCoachingExecutionContributor[]
} {
  const { score, snapshot } = input
  const discoveryPct = score.factors.discoveryCoverage

  const rankedFactors: LiveCoachingExecutionContributor[] = [
    {
      label: "Discovery quality",
      value: `${discoveryPct}%`,
      emphasis: discoveryPct >= 70,
    },
    {
      label: "Buying signal capture",
      value: `${score.factors.buyingSignalsCaptured}%`,
      emphasis: snapshot.buyingSignals.length >= 2,
    },
    {
      label: "Talk ratio",
      value: snapshot.talkRatio.inGoalRange
        ? `${snapshot.talkRatio.repTalkPercent}% rep · in goal`
        : `${snapshot.talkRatio.repTalkPercent}% rep · adjust`,
      emphasis: snapshot.talkRatio.inGoalRange,
    },
    {
      label: "Objection handling",
      value: `${score.factors.objectionsHandled}%`,
      emphasis: snapshot.objections.length === 0 || score.factors.objectionsHandled >= 70,
    },
  ]

  const opportunities: LiveCoachingExecutionContributor[] = []
  if (!snapshot.talkRatio.inGoalRange) {
    opportunities.push({
      label: "Reduce talk ratio",
      value: `Prospect at ${snapshot.talkRatio.prospectTalkPercent}% — aim for 45–60% rep`,
    })
  }
  if (snapshot.discovery.missing.length > 0) {
    opportunities.push({
      label: "Close discovery gaps",
      value: snapshot.discovery.missing
        .slice(0, 2)
        .map((area) => area.replace(/_/g, " "))
        .join(", "),
    })
  }
  if (snapshot.objections.length > 0 && score.factors.objectionsHandled < 70) {
    opportunities.push({
      label: "Address objections",
      value: snapshot.objections[0]?.label ?? "Active objection on call",
    })
  }
  if (snapshot.buyingSignals.length > 0 && score.factors.buyingSignalsCaptured < 80) {
    opportunities.push({
      label: "Lock buying momentum",
      value: "Confirm timeline and next step while intent is warm",
    })
  }

  return {
    topContributors: rankedFactors.slice(0, 3),
    opportunities: opportunities.slice(0, 2),
  }
}
