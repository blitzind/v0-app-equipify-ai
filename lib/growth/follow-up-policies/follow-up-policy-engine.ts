/** Phase GS-5C — Deterministic Smart Follow-Up Policy Engine (client-safe). */

import type { CampaignReadinessAssessment } from "@/lib/growth/campaign-readiness/campaign-readiness-types"
import {
  filterSmartFollowUpPolicies,
  rankSmartFollowUpPolicies,
} from "@/lib/growth/follow-up-policies/follow-up-policy-priority"
import {
  SMART_FOLLOW_UP_CHANNELS,
  SMART_FOLLOW_UP_POLICY_QA_MARKER,
  SMART_FOLLOW_UP_POLICY_TYPES,
  SMART_FOLLOW_UP_POLICY_TYPE_LABELS,
  type SmartFollowUpChannel,
  type SmartFollowUpChannelPlan,
  type SmartFollowUpFilter,
  type SmartFollowUpPoliciesResponse,
  type SmartFollowUpPolicy,
  type SmartFollowUpPolicyPriority,
  type SmartFollowUpPolicyType,
  type SmartFollowUpRecommendation,
  type SmartFollowUpTrigger,
  type SmartFollowUpWindow,
} from "@/lib/growth/follow-up-policies/follow-up-policy-types"
import type { HumanIntervention } from "@/lib/growth/human-interventions/human-intervention-types"
import type { OperatorInboxItem } from "@/lib/growth/operator-inbox/operator-inbox-types"

function addHours(base: Date, hours: number): string {
  return new Date(base.getTime() + hours * 60 * 60 * 1000).toISOString()
}

function resolvePolicyType(item: OperatorInboxItem, intervention?: HumanIntervention | null): SmartFollowUpPolicyType {
  const text = `${item.title} ${item.description} ${item.reasoning.join(" ")}`.toLowerCase()

  if (/\bmeeting\b|\bdemo\b|\bcalendar\b|post-meeting|post demo/i.test(text)) return "meeting_follow_up"
  if (/proposal|quote|pricing|contract/i.test(text)) return "proposal_follow_up"
  if (intervention?.intervention_type === "high_intent" || /high.?intent|interested|hot lead/i.test(text)) {
    return "high_intent_follow_up"
  }
  if (item.source === "signal" || /opportunity|signal|expansion/i.test(text)) return "opportunity_follow_up"
  if (item.source === "reply_workflow" || item.source === "inbox_thread") return "reply_follow_up"
  if (/re-?engage|no response|stale|inactive/i.test(text)) return "reengagement_follow_up"
  if (/nurture|follow.?up|check.?in/i.test(text)) return "nurture_follow_up"
  return "manual_review"
}

function resolvePriority(
  item: OperatorInboxItem,
  intervention?: HumanIntervention | null,
): SmartFollowUpPolicyPriority {
  if (intervention?.priority === "urgent" || item.priority === "urgent") return "urgent"
  if (intervention?.priority === "high" || item.priority === "high") return "high"
  if (item.priority === "medium") return "medium"
  return "low"
}

function buildFollowUpWindow(policyType: SmartFollowUpPolicyType, occurredAt: string): SmartFollowUpWindow {
  const base = new Date(occurredAt)
  switch (policyType) {
    case "high_intent_follow_up":
      return {
        window_id: "window_high_intent",
        label: "Within 24 hours",
        earliest_at: addHours(base, 4),
        latest_at: addHours(base, 24),
        rationale: "High-intent signals decay quickly — operator should review within one business day.",
      }
    case "reply_follow_up":
      return {
        window_id: "window_reply",
        label: "Within 48 hours",
        earliest_at: addHours(base, 8),
        latest_at: addHours(base, 48),
        rationale: "Reply threads benefit from timely human follow-up while context is fresh.",
      }
    case "meeting_follow_up":
      return {
        window_id: "window_meeting",
        label: "Within 72 hours post-meeting",
        earliest_at: addHours(base, 24),
        latest_at: addHours(base, 72),
        rationale: "Meeting outcomes should be reviewed and followed up within three business days.",
      }
    case "proposal_follow_up":
      return {
        window_id: "window_proposal",
        label: "Within 5 business days",
        earliest_at: addHours(base, 48),
        latest_at: addHours(base, 120),
        rationale: "Proposal threads need deliberate human review before the next touch.",
      }
    case "reengagement_follow_up":
      return {
        window_id: "window_reengage",
        label: "Within 7–14 days",
        earliest_at: addHours(base, 168),
        latest_at: addHours(base, 336),
        rationale: "Re-engagement should be spaced to avoid fatigue — operator selects final timing.",
      }
    default:
      return {
        window_id: "window_default",
        label: "Operator discretion",
        earliest_at: addHours(base, 24),
        latest_at: addHours(base, 168),
        rationale: "Default advisory window — operator confirms timing before any outreach.",
      }
  }
}

function buildChannelPlans(
  readiness: CampaignReadinessAssessment | null | undefined,
  policyType: SmartFollowUpPolicyType,
): SmartFollowUpChannelPlan[] {
  const missingChannels = new Set(readiness?.missing_channels ?? [])
  const blocked = readiness?.readiness_status === "not_ready"
  const complianceBlocked = readiness?.blockers.some((b) => b.severity === "critical") ?? false

  const plans: SmartFollowUpChannelPlan[] = SMART_FOLLOW_UP_CHANNELS.map((channel) => {
    const blockers: string[] = []
    let status: SmartFollowUpChannelPlan["status"] = "recommended"
    let eligible = true

    if (complianceBlocked || blocked) {
      blockers.push("Campaign readiness blocked — resolve blockers before channel selection")
      status = "blocked"
      eligible = false
    }

    if (channel === "email" && missingChannels.has("verified_email")) {
      blockers.push("No verified email channel")
      status = "blocked"
      eligible = false
    }
    if ((channel === "sms" || channel === "voice_drop" || channel === "call") && missingChannels.has("verified_phone")) {
      blockers.push("No verified phone channel")
      if (channel !== "call") {
        status = "blocked"
        eligible = false
      } else {
        status = "conditional"
        eligible = false
      }
    }
    if (channel === "voice_drop") {
      blockers.push("Voice Drop requires certified campaign linkage and human approval")
      if (status !== "blocked") status = "conditional"
    }

    const rationale =
      channel === "email"
        ? "Email follow-up when verified deliverability exists"
        : channel === "sms"
          ? "SMS for concise follow-up when compliance and phone verified"
          : channel === "call"
            ? "Call for high-intent or meeting follow-up when operator available"
            : "Voice Drop script planning only — no autonomous delivery"

    if (policyType === "high_intent_follow_up" && channel === "call" && eligible) {
      status = "recommended"
    }
    if (policyType === "nurture_follow_up" && channel === "email" && eligible) {
      status = "recommended"
    }

    return { channel, eligible, status, blockers, rationale }
  })

  return plans
}

function recommendedChannelsFromPlans(plans: SmartFollowUpChannelPlan[]): SmartFollowUpChannel[] {
  return plans
    .filter((plan) => plan.status === "recommended" && plan.eligible)
    .map((plan) => plan.channel)
}

function buildRisks(
  readiness: CampaignReadinessAssessment | null | undefined,
  policyType: SmartFollowUpPolicyType,
): string[] {
  const risks = [
    "Follow-up recommendations are planning only — no autonomous send or scheduling.",
    "Operator must review conversational playbook and intervention context before acting.",
  ]
  if (readiness?.readiness_status === "not_ready") {
    risks.push("Campaign readiness is not ready — defer outreach until blockers resolved.")
  }
  if (policyType === "proposal_follow_up") {
    risks.push("Pricing and proposal follow-ups require approved knowledge citations.")
  }
  return risks
}

function buildRequiredApprovals(readiness: CampaignReadinessAssessment | null | undefined): string[] {
  const approvals = ["Human operator review before any follow-up execution"]
  for (const approval of readiness?.required_approvals ?? []) {
    approvals.push(approval)
  }
  return [...new Set(approvals)].slice(0, 6)
}

function buildRecommendations(policy: Pick<SmartFollowUpPolicy, "policy_id" | "related_href" | "policy_type">): SmartFollowUpRecommendation[] {
  const recs: SmartFollowUpRecommendation[] = [
    {
      recommendation_id: `rec_review_${policy.policy_id}`,
      title: "Mark policy reviewed before planning follow-up",
      description: "Human review required — no autonomous outreach from this policy.",
      priority: "high",
      related_href: policy.related_href,
      action_type: "mark_reviewed",
    },
  ]
  if (policy.related_href) {
    recs.unshift({
      recommendation_id: `rec_open_${policy.policy_id}`,
      title: "Open related conversation or record",
      description: `Review full context for ${SMART_FOLLOW_UP_POLICY_TYPE_LABELS[policy.policy_type].toLowerCase()}.`,
      priority: "medium",
      related_href: policy.related_href,
      action_type: "open_related",
    })
  }
  return recs
}

function policyFromInboxItem(
  item: OperatorInboxItem,
  readiness: CampaignReadinessAssessment | null | undefined,
  intervention: HumanIntervention | null | undefined,
): SmartFollowUpPolicy {
  const policy_type = resolvePolicyType(item, intervention)
  const policy_id = `policy:${item.source}:${item.source_ref}`
  const occurredAt = item.occurred_at

  const trigger: SmartFollowUpTrigger = {
    trigger_id: `trigger_${item.source_ref}`,
    trigger_type: item.source,
    reason: item.description,
    evidence: item.reasoning,
    source_system: intervention?.trigger.source_system ?? item.source,
    source_ref: item.source_ref,
    occurred_at: occurredAt,
  }

  const channel_plans = buildChannelPlans(readiness, policy_type)
  const recommended_channels = recommendedChannelsFromPlans(channel_plans)
  const follow_up_window = buildFollowUpWindow(policy_type, occurredAt)
  const follow_up_recommended =
    recommended_channels.length > 0 &&
    !(readiness?.readiness_status === "not_ready" && policy_type !== "manual_review")

  const policy: SmartFollowUpPolicy = {
    qa_marker: SMART_FOLLOW_UP_POLICY_QA_MARKER,
    policy_id,
    policy_type,
    priority: resolvePriority(item, intervention),
    title: `Follow-up policy: ${item.title}`,
    description: item.description,
    follow_up_recommended,
    recommended_channels,
    channel_plans,
    follow_up_window,
    trigger,
    recommendations: [],
    reasoning: [
      ...item.reasoning,
      `Suggested window: ${follow_up_window.label}`,
      follow_up_recommended
        ? `Recommended channels: ${recommended_channels.join(", ") || "none eligible"}`
        : "Follow-up not recommended until readiness and channel blockers resolved.",
    ],
    risks: buildRisks(readiness, policy_type),
    required_approvals: buildRequiredApprovals(readiness),
    review_status: intervention?.resolution.resolution_status === "dismissed" ? "dismissed" : "pending",
    lead_id: item.lead_id,
    company_name: item.company_name,
    related_href: item.cta_href,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    generated_at: new Date().toISOString(),
  }

  policy.recommendations = buildRecommendations(policy)
  return policy
}

function policyFromIntervention(
  intervention: HumanIntervention,
  readiness: CampaignReadinessAssessment | null | undefined,
): SmartFollowUpPolicy | null {
  if (intervention.intervention_type === "risk_detected" || intervention.intervention_type === "campaign_blocked") {
    return null
  }

  const policy_type: SmartFollowUpPolicyType =
    intervention.intervention_type === "high_intent"
      ? "high_intent_follow_up"
      : intervention.intervention_type === "opportunity"
        ? "opportunity_follow_up"
        : intervention.intervention_type === "approval_required"
          ? "manual_review"
          : "reply_follow_up"

  const policy_id = `policy:intervention:${intervention.intervention_id}`
  const channel_plans = buildChannelPlans(readiness, policy_type)
  const recommended_channels = recommendedChannelsFromPlans(channel_plans)
  const follow_up_window = buildFollowUpWindow(policy_type, intervention.occurred_at)

  const policy: SmartFollowUpPolicy = {
    qa_marker: SMART_FOLLOW_UP_POLICY_QA_MARKER,
    policy_id,
    policy_type,
    priority: intervention.priority,
    title: `Follow-up policy: ${intervention.title}`,
    description: intervention.description,
    follow_up_recommended: recommended_channels.length > 0,
    recommended_channels,
    channel_plans,
    follow_up_window,
    trigger: {
      trigger_id: intervention.trigger.trigger_id,
      trigger_type: intervention.intervention_type,
      reason: intervention.trigger.reason,
      evidence: intervention.trigger.evidence,
      source_system: intervention.trigger.source_system,
      source_ref: intervention.trigger.source_ref,
      occurred_at: intervention.occurred_at,
    },
    recommendations: [],
    reasoning: [...intervention.supporting_context, `Intervention type: ${intervention.intervention_type}`],
    risks: buildRisks(readiness, policy_type),
    required_approvals: buildRequiredApprovals(readiness),
    review_status:
      intervention.resolution.resolution_status === "dismissed"
        ? "dismissed"
        : intervention.resolution.resolution_status === "reviewed"
          ? "reviewed"
          : "pending",
    lead_id: intervention.lead_id,
    company_name: intervention.company_name,
    related_href: intervention.related_href,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    generated_at: new Date().toISOString(),
  }

  policy.recommendations = buildRecommendations(policy)
  return policy
}

function countByType(policies: SmartFollowUpPolicy[]): Record<SmartFollowUpPolicyType, number> {
  const counts = Object.fromEntries(SMART_FOLLOW_UP_POLICY_TYPES.map((t) => [t, 0])) as Record<
    SmartFollowUpPolicyType,
    number
  >
  for (const policy of policies) counts[policy.policy_type] += 1
  return counts
}

/**
 * Deterministic smart follow-up policy generation — planning only, no autonomous execution.
 */
export function generateSmartFollowUpPolicies(input: {
  inbox_items: OperatorInboxItem[]
  interventions?: HumanIntervention[]
  campaign_readiness?: CampaignReadinessAssessment | null
  filter?: SmartFollowUpFilter
  limit?: number
}): SmartFollowUpPoliciesResponse {
  const interventionByRef = new Map<string, HumanIntervention>()
  for (const intervention of input.interventions ?? []) {
    interventionByRef.set(`${intervention.trigger.source_system}:${intervention.trigger.source_ref}`, intervention)
    interventionByRef.set(intervention.intervention_id, intervention)
  }

  const seen = new Set<string>()
  const policies: SmartFollowUpPolicy[] = []

  for (const item of input.inbox_items) {
    const intervention =
      interventionByRef.get(`reply_intelligence:${item.source_ref}`) ??
      interventionByRef.get(`signal_feed:${item.source_ref}`) ??
      null
    const policy = policyFromInboxItem(item, input.campaign_readiness, intervention)
    if (seen.has(policy.policy_id)) continue
    seen.add(policy.policy_id)
    policies.push(policy)
  }

  for (const intervention of input.interventions ?? []) {
    const policy = policyFromIntervention(intervention, input.campaign_readiness)
    if (!policy || seen.has(policy.policy_id)) continue
    seen.add(policy.policy_id)
    policies.push(policy)
  }

  const filtered = filterSmartFollowUpPolicies(policies, input.filter ?? "all")
  const ranked = rankSmartFollowUpPolicies(filtered)
  const limited = ranked.slice(0, input.limit ?? 50)

  return {
    qa_marker: SMART_FOLLOW_UP_POLICY_QA_MARKER,
    generated_at: new Date().toISOString(),
    total: limited.length,
    urgent_count: limited.filter((p) => p.priority === "urgent" || p.priority === "high").length,
    recommended_count: limited.filter((p) => p.follow_up_recommended).length,
    type_counts: countByType(limited),
    policies: limited,
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }
}
