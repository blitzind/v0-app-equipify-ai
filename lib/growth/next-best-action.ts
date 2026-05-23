import type { GrowthLeadEmailEventSummary } from "@/lib/growth/outbound/types"
import type { GrowthEngagementTier } from "@/lib/growth/engagement-types"
import type { GrowthLeadCallDisposition } from "@/lib/growth/call-types"
import type { GrowthDecisionMakerPresenceStatus } from "@/lib/growth/decision-maker-types"
import {
  GROWTH_NEXT_BEST_ACTION_LABELS,
  type GrowthNextBestAction,
  type GrowthNextBestActionResult,
} from "@/lib/growth/nba-types"
import { hasUsableResearch } from "@/lib/growth/call-priority"
import type { GrowthLeadStatus } from "@/lib/growth/types"

export type NextBestActionInput = {
  status: GrowthLeadStatus
  score: number | null
  website: string | null
  websiteFetchStatus: string | null
  lastResearchedAt: string | null
  latestResearchRunId: string | null
  contactPhone: string | null
  callDisposition: GrowthLeadCallDisposition | null
  followUpAt: string | null
  recommendedNextAction: string | null
  decisionMakerStatus: GrowthDecisionMakerPresenceStatus | null
  primaryDecisionMakerPhone: string | null
  emailSummary?: GrowthLeadEmailEventSummary
  engagementTier?: GrowthEngagementTier | null
  engagementLastActivityAt?: string | null
  engagementDormancyExemptUntil?: string | null
  now?: Date
}

const TERMINAL_STATUSES = new Set<GrowthLeadStatus>(["converted", "disqualified", "archived"])
const FAILED_WEBSITE_STATUSES = new Set(["blocked", "timeout", "error", "invalid_url", "too_large"])
const STRONG_FIT_THRESHOLD = 60
const HIGH_FIT_THRESHOLD = 80
const STALE_RESEARCH_DAYS = 90

const URGENT_ACTION_KEYWORDS = ["call", "phone", "discovery", "demo", "schedule"]

function trimPhone(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function researchAgeDays(lastResearchedAt: string | null, now: Date): number | null {
  if (!lastResearchedAt) return null
  const researched = new Date(lastResearchedAt)
  if (Number.isNaN(researched.getTime())) return null
  return (now.getTime() - researched.getTime()) / (24 * 60 * 60 * 1000)
}

function aiSuggestsCall(recommendedNextAction: string | null): boolean {
  if (!recommendedNextAction?.trim()) return false
  const lower = recommendedNextAction.toLowerCase()
  return URGENT_ACTION_KEYWORDS.some((word) => lower.includes(word))
}

function isWebsiteResearchBroken(input: NextBestActionInput): boolean {
  if (!input.website?.trim()) return true
  if (!hasUsableResearch(input.lastResearchedAt, input.latestResearchRunId)) return false
  const status = input.websiteFetchStatus ?? "skipped"
  return FAILED_WEBSITE_STATUSES.has(status)
}

function buildResult(
  action: GrowthNextBestAction,
  reason: string,
  blockers: string[],
  confidence: GrowthNextBestActionResult["confidence"],
): GrowthNextBestActionResult {
  return {
    action,
    label: GROWTH_NEXT_BEST_ACTION_LABELS[action],
    reason,
    blockers,
    confidence,
    actionVersion: "v2",
  }
}

export function computeGrowthLeadNextBestAction(input: NextBestActionInput): GrowthNextBestActionResult {
  const now = input.now ?? new Date()
  const fit = input.score ?? 0
  const leadPhone = trimPhone(input.contactPhone)
  const dmPhone = trimPhone(input.primaryDecisionMakerPhone)
  const usable = hasUsableResearch(input.lastResearchedAt, input.latestResearchRunId)
  const blockers: string[] = []

  if (TERMINAL_STATUSES.has(input.status) || input.callDisposition === "not_a_fit") {
    return buildResult(
      "review_disqualified",
      "Lead is terminal or marked not a fit.",
      [],
      "high",
    )
  }

  const email = input.emailSummary
  if (email?.isSuppressed) {
    return buildResult("manual_review", "Outreach email is suppressed.", ["Email suppressed"], "high")
  }

  const engagementTier = input.engagementTier ?? null
  const dormancyExempt =
    input.engagementDormancyExemptUntil &&
    Date.parse(input.engagementDormancyExemptUntil) > now.getTime()

  if (
    engagementTier === "hot" &&
    fit > 85 &&
    (input.decisionMakerStatus === "confirmed" || input.decisionMakerStatus === "verified_contactable")
  ) {
    return buildResult(
      "escalate_owner_review",
      "Hot engagement, strong fit, and confirmed decision maker — escalate for owner review.",
      [],
      "high",
    )
  }

  if (
    engagementTier === "hot" &&
    (email?.interestedReply7d || email?.latestReplyClassification === "interested")
  ) {
    if (leadPhone || dmPhone) {
      return buildResult("call_immediately", "Hot lead with positive email reply — call immediately.", [], "high")
    }
  }

  if (engagementTier === "engaged" && fit > 75 && (leadPhone || dmPhone)) {
    return buildResult("call_now", "Engaged lead with strong fit — call now.", [], "high")
  }

  const lastActivity = input.engagementLastActivityAt
  const dormantDays =
    lastActivity && !Number.isNaN(Date.parse(lastActivity))
      ? (now.getTime() - Date.parse(lastActivity)) / (24 * 60 * 60 * 1000)
      : Number.POSITIVE_INFINITY

  if (!dormancyExempt && lastActivity && dormantDays > 45 && !email?.isSuppressed) {
    return buildResult("reengage", "Lead has been dormant for more than 45 days — re-engage.", [], "medium")
  }

  if (
    input.callDisposition === "follow_up_later" &&
    input.followUpAt &&
    !Number.isNaN(new Date(input.followUpAt).getTime()) &&
    new Date(input.followUpAt).getTime() > now.getTime()
  ) {
    return buildResult(
      "wait_follow_up",
      "Follow-up is scheduled for a future date.",
      [],
      "high",
    )
  }

  if (email?.latestReplyClassification === "unclassified" || email?.latestReplyClassification === "objection") {
    if (email.replyCount14d > 0) {
      return buildResult("review_email_reply", "Recent email reply needs classification review.", [], "high")
    }
  }

  if (
    email?.interestedReply7d ||
    (email?.latestReplyClassification === "interested" && email.replyCount14d > 0)
  ) {
    if (leadPhone || dmPhone) {
      return buildResult("call_after_email_reply", "Interested email reply with callable phone.", [], "high")
    }
  }

  if (
    input.status === "in_outreach" &&
    email &&
    email.sentCount14d > 0 &&
    email.replyCount14d === 0 &&
    !email.isSuppressed
  ) {
    return buildResult("wait_for_email_reply", "Outreach sent — waiting for email reply.", [], "medium")
  }

  if (!usable) {
    return buildResult(
      "run_research",
      "No usable AI research on this lead yet.",
      ["Research not completed"],
      "high",
    )
  }

  const websiteStatus = input.websiteFetchStatus ?? "skipped"
  if (
    websiteStatus === "blocked" &&
    fit > HIGH_FIT_THRESHOLD &&
    leadPhone
  ) {
    return buildResult(
      "call_primary_contact",
      "High-fit lead with a callable primary contact despite blocked website fetch.",
      [],
      "high",
    )
  }

  if (isWebsiteResearchBroken(input)) {
    if (fit > HIGH_FIT_THRESHOLD && leadPhone) {
      return buildResult(
        "call_primary_contact",
        "Strong fit and phone on file — call primary contact while website research is retried separately.",
        [],
        "high",
      )
    }
    return buildResult(
      "fix_website_research",
      "Website is missing or website fetch failed.",
      input.website?.trim() ? [`Website fetch: ${websiteStatus}`] : ["Website missing"],
      "high",
    )
  }

  const ageDays = researchAgeDays(input.lastResearchedAt, now)
  if (ageDays != null && ageDays > STALE_RESEARCH_DAYS) {
    return buildResult(
      "refresh_research",
      "Research is more than 90 days old.",
      ["Stale research"],
      "medium",
    )
  }

  if (
    dmPhone &&
    fit > 70 &&
    (input.decisionMakerStatus === "confirmed" || input.decisionMakerStatus === "verified_contactable")
  ) {
    return buildResult(
      "call_decision_maker",
      "Confirmed decision maker with phone and strong fit — call decision maker.",
      [],
      "high",
    )
  }

  if (fit >= STRONG_FIT_THRESHOLD && leadPhone) {
    return buildResult(
      "call_primary_contact",
      "Strong fit with a callable primary contact on the lead.",
      [],
      "high",
    )
  }

  if (
    (input.callDisposition === "left_voicemail" || input.callDisposition === "call_attempted") &&
    leadPhone
  ) {
    return buildResult(
      "retry_call",
      "Previous call attempt or voicemail — retry the primary contact.",
      [],
      "medium",
    )
  }

  if (input.callDisposition === "interested" && (leadPhone || dmPhone)) {
    return buildResult(
      leadPhone ? "call_primary_contact" : "call_decision_maker",
      "Lead was marked interested — follow up with a call.",
      [],
      "high",
    )
  }

  if (leadPhone && (fit >= 50 || aiSuggestsCall(input.recommendedNextAction))) {
    return buildResult(
      "call_primary_contact",
      "Callable primary contact with moderate fit or AI call recommendation.",
      [],
      "medium",
    )
  }

  if (
    input.decisionMakerStatus === "none" ||
    input.decisionMakerStatus === "suspected"
  ) {
    if (!leadPhone) blockers.push("No phone on primary contact")
    return buildResult(
      "find_decision_maker",
      "Identify a decision maker before calling — no reliable callable contact yet.",
      blockers,
      "medium",
    )
  }

  if (!leadPhone && !dmPhone) blockers.push("No callable phone")
  return buildResult(
    "manual_review",
    "Signals are mixed — review research and contacts manually.",
    blockers,
    "low",
  )
}
