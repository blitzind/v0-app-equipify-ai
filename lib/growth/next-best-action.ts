import type { GrowthLeadEmailEventSummary } from "@/lib/growth/outbound/types"
import type { GrowthEngagementTier } from "@/lib/growth/engagement-types"
import type {
  GrowthOpportunityBlockerKey,
  GrowthOpportunityReadinessTier,
} from "@/lib/growth/opportunity-types"
import type {
  GrowthRelationshipTier,
  GrowthRelationshipTrend,
} from "@/lib/growth/relationship-types"
import type { GrowthLeadCallDisposition } from "@/lib/growth/call-types"
import type { GrowthDecisionMakerPresenceStatus } from "@/lib/growth/decision-maker-types"
import type { GrowthRevenueProbabilityTier, GrowthRevenueTrajectory } from "@/lib/growth/revenue-forecast-types"
import type { GrowthExecutivePriorityTier } from "@/lib/growth/executive-operating-types"
import type { GrowthOperationalCapacityTier } from "@/lib/growth/operational-capacity-types"
import type { GrowthWorkflowHealthStatus } from "@/lib/growth/workflow-health-types"
import type {
  GrowthSequenceFatigueRisk,
} from "@/lib/growth/sequence-types"
import { computeExecutiveSequenceWeight } from "@/lib/growth/sequence/sequence-effectiveness-score"
import {
  GROWTH_NEXT_BEST_ACTION_LABELS,
  type GrowthNextBestAction,
  type GrowthNextBestActionResult,
} from "@/lib/growth/nba-types"
import { hasUsableResearch } from "@/lib/growth/call-priority"
import {
  mapProspectResearchRecommendationToNba,
  prospectResearchNbaReason,
} from "@/lib/growth/research/nba-research-bridge"
import { isForecastRegression } from "@/lib/growth/revenue-forecast-trajectory"
import type { GrowthLeadStatus } from "@/lib/growth/types"

export type NextBestActionInput = {
  status: GrowthLeadStatus
  score: number | null
  website: string | null
  websiteFetchStatus: string | null
  lastResearchedAt: string | null
  latestResearchRunId: string | null
  latestProspectResearchRunId?: string | null
  lastProspectResearchedAt?: string | null
  prospectRecommendedNextAction?: string | null
  contactPhone: string | null
  callDisposition: GrowthLeadCallDisposition | null
  followUpAt: string | null
  recommendedNextAction: string | null
  decisionMakerStatus: GrowthDecisionMakerPresenceStatus | null
  primaryDecisionMakerPhone: string | null
  assignedTo?: string | null
  assignedAt?: string | null
  lastHumanTouchAt?: string | null
  emailSummary?: GrowthLeadEmailEventSummary
  engagementTier?: GrowthEngagementTier | null
  engagementLastActivityAt?: string | null
  engagementDormancyExemptUntil?: string | null
  relationshipStrengthTier?: GrowthRelationshipTier | null
  relationshipTrend?: GrowthRelationshipTrend | null
  opportunityReadinessTier?: GrowthOpportunityReadinessTier | null
  opportunityBlockerKeys?: GrowthOpportunityBlockerKey[]
  revenueProbabilityTier?: GrowthRevenueProbabilityTier | null
  revenueProbabilityScore?: number | null
  revenueProbabilityPreviousScore?: number | null
  revenueTrajectory?: GrowthRevenueTrajectory | null
  executivePriorityTier?: GrowthExecutivePriorityTier | null
  operationalCapacityTier?: GrowthOperationalCapacityTier | null
  capacityPressureLevel?: number
  operationalConstraintKeys?: string[]
  isProtectedOpportunity?: boolean
  workflowHealth?: GrowthWorkflowHealthStatus | null
  conversationHealthTier?: GrowthConversationHealthTier | null
  conversationSentiment?: GrowthConversationSentiment | null
  conversationUrgencyLevel?: GrowthConversationUrgencyLevel | null
  conversationBuyingIntent?: GrowthConversationBuyingIntent | null
  conversationCompetitorPressure?: number
  conversationMomentum?: GrowthConversationMomentum | null
  conversationTrend?: string | null
  recommendedSequencePatternId?: string | null
  recommendedSequenceConfidence?: number | null
  sequenceFatigueRisk?: GrowthSequenceFatigueRisk | null
  /** Sprint 3 — relationship memory influence */
  memoryCoverageScore?: number | null
  memoryRelationshipStage?: string | null
  memoryEngagementTrend?: string | null
  memoryUnresolvedObjectionCount?: number
  memoryUnresolvedHighSeverityObjectionCount?: number
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

  const opportunityTier = input.opportunityReadinessTier ?? null
  const opportunityBlockers = new Set(input.opportunityBlockerKeys ?? [])
  const executiveTier = input.executivePriorityTier ?? null
  const capacityTier = input.operationalCapacityTier ?? null
  const capacityConstraints = new Set(input.operationalConstraintKeys ?? [])
  const isProtected = input.isProtectedOpportunity ?? false

  if (
    !input.assignedTo &&
    (executiveTier === "executive_now" || executiveTier === "priority" || (engagementTier === "hot" && fit >= 70))
  ) {
    return buildResult(
      "escalate_owner_review",
      "High-priority lead has no assigned owner — assign ownership before next action.",
      ["Unassigned ownership gap"],
      "high",
    )
  }

  if (input.assignedTo && !input.lastHumanTouchAt && fit >= 60) {
    return buildResult(
      "owner_follow_up",
      "Assigned owner should take first follow-up on this lead.",
      ["Assigned owner action"],
      "medium",
    )
  }

  if (executiveTier === "executive_now") {
    return buildResult(
      "executive_takeover",
      "Executive now priority — leadership takeover recommended.",
      [],
      "high",
    )
  }

  if (capacityTier === "critical") {
    return buildResult(
      "reduce_new_outreach",
      "Critical operational capacity — reduce new outreach until load recovers.",
      ["Capacity critical"],
      "high",
    )
  }

  if (capacityConstraints.has("executive_overload")) {
    return buildResult(
      "redistribute_attention",
      "Executive overload — redistribute leadership attention across accounts.",
      ["Executive overload"],
      "high",
    )
  }

  if (
    isProtected &&
    (capacityTier === "constrained" || capacityTier === "strained") &&
    (input.revenueProbabilityTier === "forecasted" ||
      input.revenueProbabilityTier === "commit_candidate")
  ) {
    return buildResult(
      "protect_close_motion",
      "Protected close motion — preserve capacity for forecasted revenue opportunity.",
      [],
      "high",
    )
  }

  const conversationBuyingIntent = input.conversationBuyingIntent ?? null
  const conversationSentiment = input.conversationSentiment ?? null
  const conversationUrgency = input.conversationUrgencyLevel ?? null
  const conversationMomentum = input.conversationMomentum ?? null
  const competitorPressure = input.conversationCompetitorPressure ?? 0
  const conversationTier = input.conversationHealthTier ?? null
  const conversationTrend = input.conversationTrend ?? null

  if (conversationUrgency === "critical" || conversationUrgency === "high") {
    return buildResult(
      "immediate_follow_up",
      "High conversation urgency detected — immediate follow-up required.",
      [],
      "high",
    )
  }

  if (conversationBuyingIntent === "urgent" || conversationBuyingIntent === "strong") {
    return buildResult(
      "accelerate_close_motion",
      "Strong buying intent in recent conversations — accelerate close motion.",
      [],
      "high",
    )
  }

  if (competitorPressure >= 50) {
    return buildResult(
      "competitive_response_motion",
      "Elevated competitor pressure — prepare competitive response.",
      ["Competitive pressure"],
      "high",
    )
  }

  if (
    conversationMomentum === "recovering" ||
    (conversationTrend === "improving" &&
      (conversationTier === "critical" || conversationTier === "cold"))
  ) {
    return buildResult(
      "conversation_recovery_motion",
      "Conversation momentum recovering — sustain recovery motion.",
      [],
      "medium",
    )
  }

  if (conversationSentiment === "negative" || conversationSentiment === "mixed") {
    return buildResult(
      "relationship_recovery",
      "Negative or mixed conversation sentiment — relationship recovery recommended.",
      [],
      "medium",
    )
  }

  const sequencePatternId = input.recommendedSequencePatternId ?? null
  const sequenceConfidence = input.recommendedSequenceConfidence ?? 0
  const sequenceFatigue = input.sequenceFatigueRisk ?? null
  const executiveSequenceWeight = computeExecutiveSequenceWeight({
    executivePriorityTier: executiveTier,
    relationshipStrengthTier: input.relationshipStrengthTier ?? null,
    fitScore: fit,
  })

  if (
    sequencePatternId &&
    sequenceConfidence >= 60 &&
    sequenceFatigue !== "high" &&
    executiveSequenceWeight >= 55 &&
    (executiveTier === "priority" || executiveTier === "executive_now")
  ) {
    return buildResult(
      "use_executive_sequence",
      "High-value executive lead — use executive sequence pattern.",
      [],
      "high",
    )
  }

  if (
    sequencePatternId &&
    sequenceConfidence >= 60 &&
    sequenceFatigue !== "high" &&
    (input.workflowHealth === "stalled" || input.workflowHealth === "blocked")
  ) {
    return buildResult(
      "switch_sequence_pattern",
      "Stalled workflow with an available sequence pattern — switch sequence pattern.",
      ["Workflow stalled"],
      "medium",
    )
  }

  if (sequencePatternId && sequenceConfidence >= 60 && sequenceFatigue !== "high") {
    return buildResult(
      "start_recommended_sequence",
      "Recommended sequence pattern available — start recommended sequence (human approval required).",
      [],
      "high",
    )
  }

  if (opportunityTier === "priority_opportunity" && fit > 85) {
    return buildResult(
      "immediate_sales_action",
      "Priority opportunity with strong fit — take immediate sales action.",
      [],
      "high",
    )
  }

  const revenueTier = input.revenueProbabilityTier ?? null
  const workflowHealth = input.workflowHealth ?? null
  const revenueTrajectory = input.revenueTrajectory ?? null

  const previousRevenueTier =
    input.revenueProbabilityPreviousScore != null
      ? input.revenueProbabilityPreviousScore >= 85
        ? "commit_candidate"
        : input.revenueProbabilityPreviousScore >= 65
          ? "forecasted"
          : input.revenueProbabilityPreviousScore >= 45
            ? "probable"
            : input.revenueProbabilityPreviousScore >= 25
              ? "possible"
              : "unlikely"
      : null

  if (
    revenueTier === "commit_candidate" &&
    isForecastRegression({
      previousScore: input.revenueProbabilityPreviousScore ?? null,
      currentScore: input.revenueProbabilityScore ?? 0,
      previousTier: previousRevenueTier,
      currentTier: revenueTier,
      trajectory: revenueTrajectory ?? "steady",
    })
  ) {
    return buildResult(
      "executive_intervention",
      "Commit candidate with forecast regression — executive intervention required.",
      ["Forecast regression"],
      "high",
    )
  }

  if (revenueTier === "commit_candidate" && fit > 85) {
    return buildResult(
      "executive_close_motion",
      "Commit candidate with strong fit — executive close motion.",
      [],
      "high",
    )
  }

  if (revenueTier === "forecasted" && opportunityBlockers.has("missing_decision_maker")) {
    return buildResult(
      "secure_decision_maker",
      "Forecasted revenue blocked by missing decision maker — secure decision maker.",
      ["Missing decision maker"],
      "high",
    )
  }

  if (
    revenueTier === "probable" &&
    (workflowHealth === "stalled" || workflowHealth === "blocked")
  ) {
    return buildResult(
      "unblock_progress",
      "Probable revenue with stalled workflow — unblock progress.",
      ["Workflow stalled"],
      "high",
    )
  }

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

  const relationshipTier = input.relationshipStrengthTier ?? null
  const relationshipTrend = input.relationshipTrend ?? null

  if (relationshipTier === "strategic" && engagementTier === "hot") {
    return buildResult(
      "immediate_owner_attention",
      "Strategic relationship with hot engagement — immediate owner attention.",
      [],
      "high",
    )
  }

  if (relationshipTier === "trusted" && fit > 80) {
    return buildResult(
      "owner_follow_up",
      "Trusted relationship with strong fit — owner follow-up recommended.",
      [],
      "high",
    )
  }

  if (relationshipTrend === "cooling" && fit > 75) {
    return buildResult(
      "rebuild_relationship",
      "Relationship is cooling on a high-fit lead — rebuild the relationship.",
      [],
      "medium",
    )
  }

  if (
    opportunityTier === "qualified" &&
    opportunityBlockers.has("missing_decision_maker")
  ) {
    return buildResult(
      "find_decision_maker",
      "Qualified opportunity blocked by missing decision maker — find decision maker.",
      ["Missing decision maker"],
      "high",
    )
  }

  if (opportunityTier === "sales_ready" && relationshipTier === "strategic") {
    return buildResult(
      "owner_close_motion",
      "Sales-ready strategic relationship — initiate owner close motion.",
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

  if (!usable && !input.latestProspectResearchRunId) {
    return buildResult(
      "run_research",
      "No usable research on this lead yet.",
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

  const prospectNba = mapProspectResearchRecommendationToNba(input.prospectRecommendedNextAction)
  const prospectAge = researchAgeDays(input.lastProspectResearchedAt ?? null, now)
  if (prospectNba && prospectAge != null && prospectAge <= 30) {
    return buildResult(
      prospectNba,
      prospectResearchNbaReason(input.prospectRecommendedNextAction) ??
        "Prospect intelligence recommends the next operator action.",
      blockers,
      "medium",
    )
  }

  if ((input.memoryUnresolvedHighSeverityObjectionCount ?? 0) > 0) {
    return buildResult(
      "relationship_recovery",
      "Relationship memory records unresolved high-severity objections — address known concerns before pushing outreach.",
      ["Unresolved objection in lead memory"],
      "high",
    )
  }

  if (
    (input.memoryUnresolvedObjectionCount ?? 0) > 0 &&
    (input.memoryUnresolvedHighSeverityObjectionCount ?? 0) === 0
  ) {
    return buildResult(
      "relationship_recovery",
      "Relationship memory records unresolved objections — address known concerns before continuing outreach pressure.",
      ["Unresolved objection in lead memory"],
      "medium",
    )
  }

  if (
    (input.memoryEngagementTrend === "declining" || input.memoryEngagementTrend === "cooling") &&
    (input.engagementTier === "dormant" || input.engagementTier === "cold")
  ) {
    return buildResult(
      "rebuild_relationship",
      "Memory engagement trend is cooling — rebuild relationship before continuing sequence pressure.",
      [],
      "medium",
    )
  }

  if (
    (input.memoryRelationshipStage === "evaluating" || input.memoryRelationshipStage === "opportunity") &&
    (input.memoryCoverageScore ?? 0) >= 50 &&
    (leadPhone || dmPhone)
  ) {
    return buildResult(
      leadPhone ? "call_primary_contact" : "call_decision_maker",
      "Relationship memory indicates active evaluation with strong coverage — prioritize a human call.",
      [],
      "high",
    )
  }

  if ((input.memoryCoverageScore ?? 100) < 20 && input.status === "replied") {
    blockers.push("Low relationship memory coverage")
  }

  return buildResult(
    "manual_review",
    "Signals are mixed — review research and contacts manually.",
    blockers,
    "low",
  )
}
