import type { GrowthLeadCallDisposition } from "@/lib/growth/call-types"
import { hasUsableResearch } from "@/lib/growth/call-priority"
import type { GrowthDecisionMakerPresenceStatus } from "@/lib/growth/decision-maker-types"
import type { GrowthLeadAgingBucket } from "@/lib/growth/lead-aging"
import type { GrowthMomentumResult, GrowthMomentumTier } from "@/lib/growth/momentum-types"
import type { GrowthLeadStatus } from "@/lib/growth/types"

export type MomentumInput = {
  status: GrowthLeadStatus
  score: number | null
  lastResearchedAt: string | null
  latestResearchRunId: string | null
  lastHumanTouchAt: string | null
  firstHumanTouchAt: string | null
  decisionMakerStatus: GrowthDecisionMakerPresenceStatus | null
  callDisposition: GrowthLeadCallDisposition | null
  followUpAt: string | null
  websiteFetchStatus: string | null
  priorWebsiteFetchFailed: boolean
  priorFitScore: number | null
  voicemailCount30d: number
  callAttemptCount14d: number
  now?: Date
}

const TERMINAL_STATUSES = new Set<GrowthLeadStatus>(["converted", "disqualified", "archived"])

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function tierFromScore(score: number): GrowthMomentumTier {
  if (score >= 80) return "critical"
  if (score >= 60) return "high"
  if (score >= 40) return "medium"
  return "low"
}

function daysSince(iso: string | null, now: Date): number | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return (now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000)
}

type Factor = { label: string; points: number }

export function computeGrowthLeadMomentum(input: MomentumInput): GrowthMomentumResult {
  const now = input.now ?? new Date()
  const factors: Factor[] = []
  let score = 50

  if (TERMINAL_STATUSES.has(input.status)) {
    return {
      score: 0,
      tier: "low",
      whySummary: "Terminal lead status.",
    }
  }

  const researchDays = daysSince(input.lastResearchedAt, now)
  if (researchDays != null && hasUsableResearch(input.lastResearchedAt, input.latestResearchRunId)) {
    if (researchDays <= 7) {
      score += 15
      factors.push({ label: "Research recent", points: 15 })
    } else if (researchDays <= 30) {
      score += 5
      factors.push({ label: "Research within 30 days", points: 5 })
    } else if (researchDays > 90) {
      score -= 15
      factors.push({ label: "Stale research", points: -15 })
    }
  } else if (input.lastResearchedAt) {
    score -= 15
    factors.push({ label: "Stale research", points: -15 })
  }

  const touchDays = daysSince(input.lastHumanTouchAt, now)
  if (touchDays != null) {
    if (touchDays <= 3) {
      score += 15
      factors.push({ label: "Human touched recently", points: 15 })
    } else if (touchDays <= 14) {
      score += 8
      factors.push({ label: "Human touch within 2 weeks", points: 8 })
    } else if (touchDays > 21) {
      score -= 12
      factors.push({ label: "No recent human touch", points: -12 })
    }
  } else {
    score -= 12
    factors.push({ label: "No human touch yet", points: -12 })
  }

  if (
    input.decisionMakerStatus === "confirmed" ||
    input.decisionMakerStatus === "verified_contactable"
  ) {
    score += 12
    factors.push({ label: "Decision maker confirmed", points: 12 })
  }

  if (input.priorWebsiteFetchFailed && input.websiteFetchStatus === "ok") {
    score += 10
    factors.push({ label: "Website research fixed", points: 10 })
  }

  const fit = input.score ?? 0
  const priorFit = input.priorFitScore ?? 0
  if (fit > priorFit && priorFit > 0) {
    score += 8
    factors.push({ label: "Fit score increased", points: 8 })
  }

  if (
    input.followUpAt &&
    !Number.isNaN(new Date(input.followUpAt).getTime()) &&
    new Date(input.followUpAt).getTime() > now.getTime()
  ) {
    const followUpSetDays = daysSince(input.followUpAt, now)
    if (followUpSetDays != null && followUpSetDays <= 14) {
      score += 6
      factors.push({ label: "Follow-up scheduled", points: 6 })
    }
  }

  if (input.callDisposition === "interested") {
    score += 10
    factors.push({ label: "Marked interested", points: 10 })
  }

  if (input.followUpAt && !Number.isNaN(new Date(input.followUpAt).getTime())) {
    const overdueDays = (now.getTime() - new Date(input.followUpAt).getTime()) / (24 * 60 * 60 * 1000)
    if (overdueDays > 3 && (touchDays == null || touchDays > overdueDays)) {
      score -= 20
      factors.push({ label: "Ignored follow-up", points: -20 })
    }
  }

  if (input.voicemailCount30d >= 2) {
    const penalty = Math.min(16, input.voicemailCount30d * 8)
    score -= penalty
    factors.push({ label: "Multiple voicemails", points: -penalty })
  }

  if (input.websiteFetchStatus === "blocked" && fit < 80) {
    score -= 12
    factors.push({ label: "Blocked website unfixed", points: -12 })
  }

  if (input.callAttemptCount14d >= 2 && input.callDisposition !== "interested") {
    score -= 6
    factors.push({ label: "Repeated call attempts", points: -6 })
  }

  const finalScore = clampScore(score)
  const sorted = [...factors].sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
  const whyParts = sorted.slice(0, 3).map((f) => f.label)

  return {
    score: finalScore,
    tier: tierFromScore(finalScore),
    whySummary: whyParts.length ? whyParts.join(" · ") : "Standard momentum",
  }
}
