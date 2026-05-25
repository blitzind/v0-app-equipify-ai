import { commandLeadFocusHref, commandOutreachHref, commandSequenceExecutionHref } from "@/lib/growth/command/command-action-catalog"
import type {
  ExecutionPrioritySignalsInput,
  ExecutionQueueCategory,
  ExecutionQueueItem,
} from "@/lib/growth/execution/execution-priority-types"
import { computeExecutionPriorityScore } from "@/lib/growth/execution/execution-priority-score"
import { applyMeetingOutcomeToExecutionPriority } from "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-deal-adjustments"

export type ExecutionLeadContext = {
  id: string
  companyName: string
  assignedTo: string | null
  followUpAt: string | null
  workflowHealth: string | null
  nextBestAction: string | null
  revenueTrajectory: string | null
  dealRiskScore: number | null
  closeWindow: string | null
  closeProbability: number | null
  callOverallScore: number | null
  callNextStepScore: number | null
  callCompetitorRisk: number | null
  callBuyingSignals: number
  callObjections: number
  meetingFollowUpOverdue: boolean
  unansweredReplies: number
  isStaleOpportunity: boolean
  competitorDetected: boolean
  buyingSignalDetected: boolean
  renewalRisk: boolean
  expansionCandidate: boolean
  openObjections: boolean
  onboardingStalled: boolean
  providerFailure: boolean
  calendarConflict: boolean
  callQualityDecline: boolean
  opportunityAmount: number
  meetingOutcomeScore?: number | null
  meetingQualityScore?: number | null
  meetingFollowUpRecommendation?: string | null
  referenceIds?: {
    outreachQueueId?: string | null
    enrollmentId?: string | null
    meetingId?: string | null
    replyId?: string | null
  }
}

function isOverdue(iso: string | null | undefined): boolean {
  if (!iso) return false
  return Date.parse(iso) <= Date.now()
}

function buildSignals(ctx: ExecutionLeadContext): ExecutionPrioritySignalsInput {
  const followUpOverdue = isOverdue(ctx.followUpAt)
  return {
    deal_risk_increase:
      (ctx.dealRiskScore ?? 0) >= 65 || ctx.revenueTrajectory === "at_risk" || ctx.revenueTrajectory === "declining",
    competitor_detected: ctx.competitorDetected || (ctx.callCompetitorRisk ?? 0) >= 55,
    buying_signal_detected: ctx.buyingSignalDetected || ctx.callBuyingSignals > 0,
    meeting_follow_up_overdue: ctx.meetingFollowUpOverdue,
    next_step_missing: (ctx.callNextStepScore ?? 100) < 45,
    unanswered_reply: ctx.unansweredReplies > 0,
    high_confidence_close_window:
      ["this_week", "next_14_days"].includes(ctx.closeWindow ?? "") && (ctx.closeProbability ?? 0) >= 55,
    renewal_risk: ctx.renewalRisk,
    expansion_candidate: ctx.expansionCandidate,
    low_call_score: ctx.callOverallScore !== null && ctx.callOverallScore < 45,
    stalled_opportunity: ctx.isStaleOpportunity || ctx.workflowHealth === "stalled",
    no_owner_assigned: !ctx.assignedTo,
    open_objections: ctx.openObjections || ctx.callObjections > 0,
    onboarding_stalled: ctx.onboardingStalled,
    provider_failure: ctx.providerFailure,
    calendar_conflict: ctx.calendarConflict,
    call_quality_decline: ctx.callQualityDecline,
    missing_follow_up: followUpOverdue,
    stale_opportunity: ctx.isStaleOpportunity,
  }
}

function resolveCategory(signals: ExecutionPrioritySignalsInput): ExecutionQueueCategory {
  if (signals.renewal_risk) return "renewal"
  if (signals.expansion_candidate) return "expansion"
  if (signals.meeting_follow_up_overdue) return "meeting_completion"
  if (signals.unanswered_reply || signals.missing_follow_up) return "follow_up_recovery"
  if (signals.stalled_opportunity || signals.deal_risk_increase || signals.high_confidence_close_window) {
    return "deal_closing"
  }
  if (signals.no_owner_assigned) return "ownership"
  if (signals.provider_failure || signals.calendar_conflict) return "revenue_protection"
  return "revenue_protection"
}

function resolveTitle(category: ExecutionQueueCategory, signals: ExecutionPrioritySignalsInput): string {
  if (signals.renewal_risk) return "Protect renewal"
  if (signals.expansion_candidate) return "Pursue expansion"
  if (signals.meeting_follow_up_overdue) return "Complete meeting follow-up"
  if (signals.unanswered_reply) return "Handle unanswered reply"
  if (signals.missing_follow_up) return "Clear overdue follow-up"
  if (signals.high_confidence_close_window) return "Advance close window deal"
  if (signals.stalled_opportunity) return "Unstall opportunity"
  if (signals.deal_risk_increase) return "Reduce deal risk"
  if (signals.next_step_missing) return "Secure next step"
  if (signals.competitor_detected) return "Address competitor pressure"
  if (signals.no_owner_assigned) return "Assign owner"
  if (category === "research") return "Complete research"
  return "Execute revenue action"
}

function resolveCta(ctx: ExecutionLeadContext): { label: string; href: string } {
  if (ctx.referenceIds?.outreachQueueId) {
    return { label: "Review outreach", href: commandOutreachHref(ctx.referenceIds.outreachQueueId) }
  }
  if (ctx.referenceIds?.enrollmentId) {
    return { label: "Open sequence", href: commandSequenceExecutionHref(ctx.referenceIds.enrollmentId) }
  }
  if (ctx.unansweredReplies > 0) {
    return { label: "Open reply inbox", href: "/admin/growth/replies?view=unanswered" }
  }
  if (ctx.meetingFollowUpOverdue) {
    return { label: "Open meetings", href: "/admin/growth/meetings?view=followups_due" }
  }
  if (ctx.callOverallScore !== null && ctx.callOverallScore < 55) {
    return { label: "Review call score", href: commandLeadFocusHref(ctx.id, "call-copilot") }
  }
  if (ctx.nextBestAction === "call_prospect" || ctx.nextBestAction === "start_call_copilot") {
    return { label: "Start call copilot", href: commandLeadFocusHref(ctx.id, "call-copilot") }
  }
  if (ctx.nextBestAction === "run_research" || ctx.nextBestAction === "review_research") {
    return { label: "Run research", href: commandLeadFocusHref(ctx.id, "research") }
  }
  return { label: "Open lead", href: commandLeadFocusHref(ctx.id, "command") }
}

function estimateRevenueInfluence(ctx: ExecutionLeadContext, score: number): number {
  const base = Math.max(500, ctx.opportunityAmount * 0.05)
  return Math.round(base * (score / 100))
}

function estimateEffort(signals: ExecutionPrioritySignalsInput): number {
  if (signals.meeting_follow_up_overdue || signals.deal_risk_increase) return 15
  if (signals.unanswered_reply || signals.missing_follow_up) return 10
  if (signals.no_owner_assigned) return 5
  return 12
}

export function buildExecutionQueueItem(ctx: ExecutionLeadContext): ExecutionQueueItem | null {
  const signalInput = buildSignals(ctx)
  const activeCount = Object.values(signalInput).filter(Boolean).length
  if (activeCount === 0) return null

  const { executionPriorityScore: baseScore, signals } = computeExecutionPriorityScore(signalInput)
  const outcomeWeight = applyMeetingOutcomeToExecutionPriority({
    meetingQualityScore: ctx.meetingQualityScore,
    meetingOutcomeScore: ctx.meetingOutcomeScore,
    followUpRecommendation: ctx.meetingFollowUpRecommendation,
  })
  const executionPriorityScore = Math.max(0, Math.min(100, baseScore + outcomeWeight))
  const priorityBand = resolveExecutionPriorityBand(executionPriorityScore)
  if (executionPriorityScore < 25) return null

  const category = resolveCategory(signalInput)
  const cta = resolveCta(ctx)
  const topSignal = signals[0]?.label ?? "Revenue execution required"

  return {
    id: `exec:${ctx.id}:${category}`,
    leadId: ctx.id,
    companyName: ctx.companyName,
    title: resolveTitle(category, signalInput),
    why: topSignal,
    category,
    executionPriorityScore,
    priorityBand,
    signals,
    effortMinutes: estimateEffort(signalInput),
    revenueInfluence: estimateRevenueInfluence(ctx, executionPriorityScore),
    ownerUserId: ctx.assignedTo,
    ctaLabel: cta.label,
    ctaHref: cta.href,
    referenceId:
      ctx.referenceIds?.outreachQueueId ??
      ctx.referenceIds?.enrollmentId ??
      ctx.referenceIds?.meetingId ??
      ctx.referenceIds?.replyId ??
      null,
  }
}

export function buildExecutionQueueItems(contexts: ExecutionLeadContext[]): ExecutionQueueItem[] {
  return contexts
    .map(buildExecutionQueueItem)
    .filter((item): item is ExecutionQueueItem => item !== null)
    .sort((a, b) => {
      if (b.executionPriorityScore !== a.executionPriorityScore) {
        return b.executionPriorityScore - a.executionPriorityScore
      }
      return b.revenueInfluence - a.revenueInfluence
    })
}

export function rankExecutionQueueItems(items: ExecutionQueueItem[], limit = 50): ExecutionQueueItem[] {
  const byLead = new Map<string, number>()
  const ranked: ExecutionQueueItem[] = []
  for (const item of items) {
    const count = byLead.get(item.leadId) ?? 0
    if (count >= 2) continue
    byLead.set(item.leadId, count + 1)
    ranked.push(item)
    if (ranked.length >= limit) break
  }
  return ranked
}
