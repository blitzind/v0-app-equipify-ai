/** Signal recommendation engine — recommendations only, human approval required (client-safe). */

import type {
  LeadSignalEvent,
  LeadSignalType,
  LeadSignalUrgency,
  SignalQueueHint,
} from "@/lib/growth/signal-intelligence/lead-signal-event-types"
import type {
  SignalFeedRecommendation,
  SignalRecommendationPriority,
} from "@/lib/growth/signal-intelligence/signal-feed-types"
import { estimateSignalExpectedImpact } from "@/lib/growth/signal-intelligence/signal-revenue-impact-estimators"
import { commandCenterLabelForSignalType, resolveSignalQueueHint } from "@/lib/growth/signal-intelligence/signal-queue-hints"

export type SignalRecommendationContext = {
  event: Pick<
    LeadSignalEvent,
    "signalType" | "sourceDomain" | "confidence" | "urgency" | "routeActions" | "metadata"
  >
  lead?: {
    score?: number | null
    engagement_score?: number | null
    engagement_tier?: string | null
    opportunity_readiness_score?: number | null
    opportunity_readiness_tier?: string | null
    revenue_probability_score?: number | null
  } | null
  queue_hint?: SignalQueueHint | null
  account_playbook_key?: string | null
  recent_activity_count?: number
}

function urgencyToPriority(urgency: LeadSignalUrgency | string): SignalRecommendationPriority {
  if (urgency === "urgent") return "urgent"
  if (urgency === "high") return "high"
  if (urgency === "normal") return "medium"
  return "low"
}

function boostPriority(
  base: SignalRecommendationPriority,
  lead: SignalRecommendationContext["lead"],
): SignalRecommendationPriority {
  let score = 0
  if (base === "urgent") score += 4
  else if (base === "high") score += 3
  else if (base === "medium") score += 2
  else score += 1

  if ((lead?.engagement_tier ?? "") === "hot") score += 2
  if ((lead?.opportunity_readiness_tier ?? "") === "priority_opportunity") score += 2
  if ((lead?.revenue_probability_score ?? 0) >= 70) score += 1
  if ((lead?.score ?? 0) >= 75) score += 1

  if (score >= 7) return "urgent"
  if (score >= 5) return "high"
  if (score >= 3) return "medium"
  return "low"
}

function defaultActionForSignal(signalType: LeadSignalType, playbookKey?: string | null): string {
  switch (signalType) {
    case "company_hiring":
    case "expansion_event":
      return playbookKey?.includes("biomedical")
        ? "Recommend Biomedical Expansion Sequence"
        : "Recommend Expansion Sequence"
    case "pricing_page_visit":
    case "demo_page_visit":
    case "contact_page_visit":
    case "repeat_visit":
      return "Recommend Meeting Outreach"
    case "competitor_search":
      return "Recommend Competitive Positioning Sequence"
    case "high_intent_search":
    case "category_interest":
      return "Recommend Sequence"
    case "meeting_completed":
      return "Recommend Opportunity Review"
    case "positive_reply":
    case "meeting_requested":
      return "Recommend Follow-Up Outreach"
    case "funding_event":
      return "Review Company & Pipeline Fit"
    case "opportunity_created":
    case "stage_advanced":
      return "Review Opportunity Stage"
    case "deal_won":
      return "Review Won Deal Attribution"
    default:
      return "Review Signal & Next Best Action"
  }
}

function reasoningForSignal(
  signalType: LeadSignalType,
  ctx: SignalRecommendationContext,
): string {
  const label = commandCenterLabelForSignalType(signalType) ?? signalType.replace(/_/g, " ")
  const engagement = ctx.lead?.engagement_tier ?? "unknown"
  const readiness = ctx.lead?.opportunity_readiness_tier ?? "unknown"
  return `${label} detected. Engagement tier: ${engagement}. Opportunity readiness: ${readiness}. Human approval required before any outreach or enrollment.`
}

export function buildSignalRecommendations(
  ctx: SignalRecommendationContext,
): SignalFeedRecommendation {
  const hint =
    ctx.queue_hint ??
    resolveSignalQueueHint({
      leadId: "",
      sourceDomain: ctx.event.sourceDomain,
      signalType: ctx.event.signalType,
      confidence: ctx.event.confidence,
      urgency: ctx.event.urgency as LeadSignalUrgency,
      evidenceRef: { table: "signal_events", id: "" },
      attributionImpacting: false,
      recomputeScope: "full",
      routeActions: ctx.event.routeActions,
      metadata: ctx.event.metadata,
    })

  const recommended_action =
    hint?.label === "Recommend sequence"
      ? defaultActionForSignal(ctx.event.signalType, ctx.account_playbook_key)
      : hint?.label ?? defaultActionForSignal(ctx.event.signalType, ctx.account_playbook_key)

  const impact = estimateSignalExpectedImpact(ctx.event.signalType)
  const basePriority = urgencyToPriority(ctx.event.urgency)

  return {
    recommended_action,
    reasoning: reasoningForSignal(ctx.event.signalType, ctx),
    expected_impact: impact.summary,
    priority: boostPriority(basePriority, ctx.lead),
    requires_human_approval: true,
    queue_hint: hint,
  }
}
