import type { GrowthLeadEmailEventSummary } from "@/lib/growth/outbound/types"
import type { GrowthCallPriorityTier, GrowthLeadCallDisposition } from "@/lib/growth/call-types"
import type { GrowthLeadResearchPriority, GrowthLeadStatus } from "@/lib/growth/types"

export type CallPriorityInput = {
  researchPriority: GrowthLeadResearchPriority
  score: number | null
  status: GrowthLeadStatus
  lastResearchedAt: string | null
  recommendedNextAction: string | null
  leadNotes: string | null
  manualResearchNotes: string | null
  callDisposition: GrowthLeadCallDisposition | null
  followUpAt: string | null
  callPriorityOverride: number | null
  emailSummary?: GrowthLeadEmailEventSummary
  now?: Date
}

export type CallPriorityResult = {
  computedScore: number
  effectiveScore: number
  tier: GrowthCallPriorityTier
  whySummary: string
  excludedFromQueue: boolean
}

const TERMINAL_STATUSES = new Set<GrowthLeadStatus>(["converted", "disqualified", "archived"])

const RESEARCH_PRIORITY_POINTS: Record<GrowthLeadResearchPriority, number> = {
  low: 0,
  normal: 10,
  high: 20,
  critical: 30,
}

const STATUS_READINESS_POINTS: Partial<Record<GrowthLeadStatus, number>> = {
  call_ready: 20,
  qualified: 16,
  replied: 14,
  enriched: 10,
  in_outreach: 8,
  new: 0,
  researching: 0,
}

const DISPOSITION_PENALTY: Partial<Record<GrowthLeadCallDisposition, number>> = {
  call_attempted: 5,
  left_voicemail: 8,
}

const URGENT_ACTION_KEYWORDS = ["call", "phone", "discovery", "demo", "schedule"]
const MODERATE_ACTION_KEYWORDS = ["verify", "confirm", "follow up", "reach out"]
const NOTES_URGENCY_KEYWORDS = ["hot", "urgent", "callback", "call today", "priority"]

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function tierFromScore(score: number): GrowthCallPriorityTier {
  if (score >= 80) return "critical"
  if (score >= 60) return "high"
  if (score >= 40) return "medium"
  return "low"
}

function recencyPoints(lastResearchedAt: string | null, now: Date): number {
  if (!lastResearchedAt) return -15
  const researched = new Date(lastResearchedAt)
  if (Number.isNaN(researched.getTime())) return -15
  const ageDays = (now.getTime() - researched.getTime()) / (24 * 60 * 60 * 1000)
  if (ageDays <= 7) return 15
  if (ageDays <= 30) return 5
  if (ageDays <= 90) return -10
  return -10
}

function keywordPoints(text: string | null, urgent: string[], moderate: string[]): number {
  if (!text?.trim()) return 0
  const lower = text.toLowerCase()
  if (urgent.some((word) => lower.includes(word))) return 10
  if (moderate.some((word) => lower.includes(word))) return 5
  return 0
}

function combinedNotes(leadNotes: string | null, manualResearchNotes: string | null): string {
  return [leadNotes, manualResearchNotes].filter(Boolean).join(" ")
}

function isDeferred(input: CallPriorityInput, now: Date): boolean {
  if (input.callDisposition !== "follow_up_later" || !input.followUpAt) return false
  const followUp = new Date(input.followUpAt)
  return !Number.isNaN(followUp.getTime()) && followUp.getTime() > now.getTime()
}

export function computeGrowthCallPriority(input: CallPriorityInput): CallPriorityResult {
  const now = input.now ?? new Date()

  if (TERMINAL_STATUSES.has(input.status) || input.callDisposition === "not_a_fit") {
    return {
      computedScore: 0,
      effectiveScore: input.callPriorityOverride != null ? clampScore(input.callPriorityOverride) : 0,
      tier: tierFromScore(input.callPriorityOverride ?? 0),
      whySummary: "Excluded from call queue (terminal status or not a fit).",
      excludedFromQueue: true,
    }
  }

  if (isDeferred(input, now)) {
    return {
      computedScore: 0,
      effectiveScore: input.callPriorityOverride != null ? clampScore(input.callPriorityOverride) : 0,
      tier: tierFromScore(input.callPriorityOverride ?? 0),
      whySummary: "Deferred until follow-up date.",
      excludedFromQueue: true,
    }
  }

  if (input.emailSummary?.isSuppressed) {
    return {
      computedScore: 0,
      effectiveScore: input.callPriorityOverride != null ? clampScore(input.callPriorityOverride) : 0,
      tier: tierFromScore(input.callPriorityOverride ?? 0),
      whySummary: "Excluded — outreach email suppressed.",
      excludedFromQueue: true,
    }
  }

  const fitScore = input.score ?? 0
  const base =
    RESEARCH_PRIORITY_POINTS[input.researchPriority] +
    Math.round(0.45 * fitScore) +
    (STATUS_READINESS_POINTS[input.status] ?? 0) +
    recencyPoints(input.lastResearchedAt, now) +
    keywordPoints(input.recommendedNextAction, URGENT_ACTION_KEYWORDS, MODERATE_ACTION_KEYWORDS) +
    keywordPoints(combinedNotes(input.leadNotes, input.manualResearchNotes), [], NOTES_URGENCY_KEYWORDS)

  const penalty = input.callDisposition ? (DISPOSITION_PENALTY[input.callDisposition] ?? 0) : 0
  const emailBoost =
    (input.emailSummary?.interestedReply7d ? 6 : 0) +
    (input.emailSummary && input.emailSummary.clickCount14d > 0 && input.emailSummary.replyCount14d === 0 ? 4 : 0) +
    (input.emailSummary && input.emailSummary.openCount14d > 0 && input.emailSummary.replyCount14d === 0 ? 2 : 0)
  const computedScore = clampScore(base - penalty + emailBoost)
  const effectiveScore =
    input.callPriorityOverride != null ? clampScore(input.callPriorityOverride) : computedScore
  const tier = tierFromScore(effectiveScore)

  const whyParts: string[] = []
  if (input.callPriorityOverride != null) {
    whyParts.push(`Manual override ${effectiveScore}`)
  } else {
    if (fitScore >= 70) whyParts.push(`High fit ${fitScore}`)
    else if (fitScore > 0) whyParts.push(`Fit ${fitScore}`)
    if (input.researchPriority === "critical" || input.researchPriority === "high") {
      whyParts.push(`${input.researchPriority} research priority`)
    }
    if (input.status === "call_ready" || input.status === "qualified") {
      whyParts.push(input.status.replace(/_/g, " "))
    }
    if (!input.lastResearchedAt) whyParts.push("needs research")
    else {
      const recency = recencyPoints(input.lastResearchedAt, now)
      if (recency >= 15) whyParts.push("recently researched")
      if (recency <= -10) whyParts.push("stale research")
    }
    if (keywordPoints(input.recommendedNextAction, URGENT_ACTION_KEYWORDS, MODERATE_ACTION_KEYWORDS) >= 10) {
      whyParts.push("AI recommends a call")
    }
    if (input.callDisposition === "interested") whyParts.push("marked interested")
    if (input.callDisposition === "call_attempted") whyParts.push("recent call attempt")
    if (input.callDisposition === "left_voicemail") whyParts.push("voicemail left")
    if (input.emailSummary?.interestedReply7d) whyParts.push("interested email reply")
  }

  return {
    computedScore,
    effectiveScore,
    tier,
    whySummary: whyParts.length ? whyParts.slice(0, 4).join(" · ") : "Standard queue priority",
    excludedFromQueue: false,
  }
}

export function hasUsableResearch(lastResearchedAt: string | null, latestResearchRunId: string | null): boolean {
  return Boolean(lastResearchedAt && latestResearchRunId)
}

export function isNeedsWebsiteResearch(input: {
  website: string | null
  websiteFetchStatus: string | null
  hasUsableResearch: boolean
}): boolean {
  const website = input.website?.trim()
  if (!website) return true
  if (!input.hasUsableResearch) return false
  const status = input.websiteFetchStatus ?? "skipped"
  if (status === "blocked") return true
  if (["timeout", "error", "invalid_url", "too_large"].includes(status)) return true
  return false
}

export function matchesCallQueueFilter(
  filter: import("@/lib/growth/call-types").GrowthCallQueueFilter,
  row: {
    status: GrowthLeadStatus
    score: number | null
    lastResearchedAt: string | null
    latestResearchRunId: string | null
    callDisposition: GrowthLeadCallDisposition | null
    followUpAt: string | null
    website: string | null
    websiteFetchStatus: string | null
  },
  now: Date = new Date(),
): boolean {
  if (TERMINAL_STATUSES.has(row.status)) return false

  const usable = hasUsableResearch(row.lastResearchedAt, row.latestResearchRunId)
  const deferred =
    row.callDisposition === "follow_up_later" &&
    row.followUpAt &&
    !Number.isNaN(new Date(row.followUpAt).getTime()) &&
    new Date(row.followUpAt).getTime() > now.getTime()

  switch (filter) {
    case "call_ready":
      return (
        (row.status === "call_ready" || row.status === "qualified") &&
        usable &&
        row.callDisposition !== "not_a_fit" &&
        !deferred
      )
    case "high_fit":
      return usable && (row.score ?? 0) >= 70 && row.callDisposition !== "not_a_fit"
    case "needs_research":
      return !usable
    case "needs_website_research":
      return isNeedsWebsiteResearch({
        website: row.website,
        websiteFetchStatus: row.websiteFetchStatus,
        hasUsableResearch: usable,
      })
    default:
      return false
  }
}
