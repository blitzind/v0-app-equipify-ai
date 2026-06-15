/** Phase GS-3E — Deterministic Human Intervention Engine (client-safe). */

import type { CampaignReadinessAssessment } from "@/lib/growth/campaign-readiness/campaign-readiness-types"
import {
  HUMAN_INTERVENTION_QA_MARKER,
  HUMAN_INTERVENTION_TYPES,
  HUMAN_INTERVENTION_TYPE_LABELS,
  type HumanIntervention,
  type HumanInterventionAction,
  type HumanInterventionPriority,
  type HumanInterventionRecommendation,
  type HumanInterventionRelatedEntity,
  type HumanInterventionTrigger,
  type HumanInterventionType,
  type HumanInterventionsResponse,
} from "@/lib/growth/human-interventions/human-intervention-types"
import {
  filterHumanInterventions,
  rankHumanInterventions,
} from "@/lib/growth/human-interventions/human-intervention-priority"
import type { OperatorInboxItem } from "@/lib/growth/operator-inbox/operator-inbox-types"
import type { HumanInterventionFilter } from "@/lib/growth/human-interventions/human-intervention-types"

function mapPriority(value: OperatorInboxItem["priority"]): HumanInterventionPriority {
  return value
}

function mapInboxSourceToSystem(source: OperatorInboxItem["source"]): string {
  switch (source) {
    case "signal":
      return "signal_feed"
    case "reply_workflow":
      return "reply_intelligence"
    case "human_approval":
      return "human_execution_queue"
    case "inbox_thread":
      return "inbox_v2"
    case "attention":
      return "attention_feed"
    default:
      return "operator_inbox"
  }
}

function resolveInterventionTypeFromInboxItem(item: OperatorInboxItem): HumanInterventionType {
  const text = `${item.title} ${item.description} ${item.reasoning.join(" ")}`.toLowerCase()

  if (item.source === "human_approval") return "approval_required"
  if (item.source === "reply_workflow" || item.source === "inbox_thread") {
    if (/interested|meeting|positive|hot|urgent/i.test(text)) return "high_intent"
    return "reply_required"
  }
  if (item.source === "signal") {
    if (item.priority === "urgent" || item.priority === "high") return "high_intent"
    if (/risk|compliance|suppression|block/i.test(text)) return "risk_detected"
    return "opportunity"
  }
  if (item.source === "attention") {
    if (/risk|compliance|block/i.test(text)) return "risk_detected"
    return "manual_review"
  }
  return "manual_review"
}

function buildRecommendations(
  intervention: Pick<HumanIntervention, "intervention_id" | "intervention_type" | "related_href" | "title">,
): HumanInterventionRecommendation[] {
  const recs: HumanInterventionRecommendation[] = [
    {
      recommendation_id: `rec_review_${intervention.intervention_id}`,
      title: "Review before any outbound action",
      description: "Human operator must review context and approve next steps manually.",
      priority: "high",
      related_href: intervention.related_href,
      action_type: "mark_reviewed",
    },
  ]

  if (intervention.related_href) {
    recs.unshift({
      recommendation_id: `rec_open_${intervention.intervention_id}`,
      title: "Open related item for full context",
      description: `Inspect supporting records for ${HUMAN_INTERVENTION_TYPE_LABELS[intervention.intervention_type].toLowerCase()}.`,
      priority: "medium",
      related_href: intervention.related_href,
      action_type: "open_related",
    })
  }

  return recs
}

function buildAvailableActions(interventionId: string): HumanInterventionAction[] {
  return [
    { action_id: `${interventionId}:view`, label: "View Details", action_type: "view_details", requires_confirmation: true },
    { action_id: `${interventionId}:review`, label: "Mark Reviewed", action_type: "mark_reviewed", requires_confirmation: true },
    { action_id: `${interventionId}:dismiss`, label: "Dismiss", action_type: "dismiss", requires_confirmation: true },
  ]
}

function interventionFromInboxItem(item: OperatorInboxItem): HumanIntervention {
  const intervention_type = resolveInterventionTypeFromInboxItem(item)
  const intervention_id = `intervention:${item.source}:${item.source_ref}`

  const trigger: HumanInterventionTrigger = {
    trigger_id: `trigger_${item.source_ref}`,
    trigger_type: item.source,
    reason: item.description,
    evidence: item.reasoning,
    source_system: mapInboxSourceToSystem(item.source),
    source_ref: item.source_ref,
  }

  const related_entities: HumanInterventionRelatedEntity[] = []
  if (item.lead_id) {
    related_entities.push({
      entity_type: "lead",
      entity_id: item.lead_id,
      label: item.company_name ?? "Lead",
      href: `/admin/growth/leads/${item.lead_id}`,
    })
  }
  if (item.source === "inbox_thread") {
    related_entities.push({
      entity_type: "thread",
      entity_id: item.source_ref,
      label: item.title,
      href: item.cta_href,
    })
  }
  if (item.source === "signal") {
    related_entities.push({
      entity_type: "signal",
      entity_id: item.source_ref,
      label: item.title,
      href: item.cta_href,
    })
  }
  if (item.source === "human_approval") {
    related_entities.push({
      entity_type: "approval",
      entity_id: item.source_ref,
      label: item.title,
      href: item.cta_href,
    })
  }

  const resolutionStatus =
    item.source === "signal" && item.status === "reviewed"
      ? "reviewed"
      : item.status === "dismissed"
        ? "dismissed"
        : "pending"

  const intervention: HumanIntervention = {
    qa_marker: HUMAN_INTERVENTION_QA_MARKER,
    intervention_id,
    intervention_type,
    priority: mapPriority(item.priority),
    title: item.title,
    description: item.description,
    trigger,
    recommendations: [],
    supporting_context: [
      ...item.reasoning,
      "Orchestration recommendation only — no autonomous send, reply, or execution.",
    ],
    related_entities,
    available_actions: buildAvailableActions(intervention_id),
    resolution: {
      resolution_status: resolutionStatus,
      resolved_at: null,
      resolved_by: null,
    },
    lead_id: item.lead_id,
    company_name: item.company_name,
    occurred_at: item.occurred_at,
    related_href: item.cta_href,
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }

  intervention.recommendations = buildRecommendations(intervention)
  return intervention
}

function interventionsFromCampaignReadiness(assessment: CampaignReadinessAssessment): HumanIntervention[] {
  const results: HumanIntervention[] = []

  if (assessment.readiness_status === "not_ready") {
    for (const blocker of assessment.blockers.slice(0, 3)) {
      const intervention_type: HumanInterventionType =
        blocker.dimension_id === "compliance_requirements"
          ? "risk_detected"
          : blocker.dimension_id === "channel_readiness" ||
              blocker.dimension_id === "verified_contact_channels"
            ? "channel_issue"
            : "campaign_blocked"

      const intervention_id = `intervention:campaign_readiness:${blocker.blocker_id}`
      const intervention: HumanIntervention = {
        qa_marker: HUMAN_INTERVENTION_QA_MARKER,
        intervention_id,
        intervention_type,
        priority: blocker.severity === "critical" ? "urgent" : "high",
        title: `Campaign readiness: ${blocker.message}`,
        description: blocker.resolution_hint,
        trigger: {
          trigger_id: blocker.blocker_id,
          trigger_type: "campaign_readiness_blocker",
          reason: blocker.message,
          evidence: [blocker.resolution_hint],
          source_system: "campaign_readiness_engine",
          source_ref: assessment.assessment_id,
        },
        recommendations: [],
        supporting_context: [
          `Readiness score: ${assessment.readiness_score}/100`,
          `Status: ${assessment.readiness_status}`,
        ],
        related_entities: assessment.lead_id
          ? [
              {
                entity_type: "lead",
                entity_id: assessment.lead_id,
                label: assessment.company_name ?? "Lead",
                href: `/admin/growth/leads/${assessment.lead_id}`,
              },
              {
                entity_type: "campaign",
                entity_id: assessment.assessment_id,
                label: "Campaign readiness assessment",
                href: blocker.related_asset_href,
              },
            ]
          : [],
        available_actions: buildAvailableActions(intervention_id),
        resolution: {
          resolution_status: assessment.review_status === "reviewed" ? "reviewed" : "pending",
          resolved_at: null,
          resolved_by: null,
        },
        lead_id: assessment.lead_id,
        company_name: assessment.company_name,
        occurred_at: assessment.generated_at,
        related_href: blocker.related_asset_href ?? (assessment.lead_id ? `/admin/growth/leads/${assessment.lead_id}` : null),
        requires_human_review: true,
        autonomous_execution_enabled: false,
      }
      intervention.recommendations = buildRecommendations(intervention)
      results.push(intervention)
    }
  }

  for (const approval of assessment.required_approvals.slice(0, 2)) {
    const intervention_id = `intervention:campaign_approval:${assessment.assessment_id}:${approval.slice(0, 24)}`
    const intervention: HumanIntervention = {
      qa_marker: HUMAN_INTERVENTION_QA_MARKER,
      intervention_id,
      intervention_type: "approval_required",
      priority: "high",
      title: `Approval required: ${approval}`,
      description: "Campaign readiness assessment flagged a missing human approval.",
      trigger: {
        trigger_id: `approval_${assessment.assessment_id}`,
        trigger_type: "missing_approval",
        reason: approval,
        evidence: assessment.required_human_actions.slice(0, 2),
        source_system: "campaign_readiness_engine",
        source_ref: assessment.assessment_id,
      },
      recommendations: [],
      supporting_context: assessment.missing_assets.slice(0, 3),
      related_entities: [],
      available_actions: buildAvailableActions(intervention_id),
      resolution: { resolution_status: "pending", resolved_at: null, resolved_by: null },
      lead_id: assessment.lead_id,
      company_name: assessment.company_name,
      occurred_at: assessment.generated_at,
      related_href: "/admin/growth/outreach/approval",
      requires_human_review: true,
      autonomous_execution_enabled: false,
    }
    intervention.recommendations = buildRecommendations(intervention)
    results.push(intervention)
  }

  return results
}

function countByType(interventions: HumanIntervention[]): Record<HumanInterventionType, number> {
  const counts = Object.fromEntries(
    HUMAN_INTERVENTION_TYPES.map((type) => [type, 0]),
  ) as Record<HumanInterventionType, number>
  for (const item of interventions) counts[item.intervention_type] += 1
  return counts
}

/**
 * Deterministic human intervention generation — orchestration only, no autonomous execution.
 */
export function generateHumanInterventions(input: {
  inbox_items: OperatorInboxItem[]
  campaign_readiness?: CampaignReadinessAssessment | null
  filter?: HumanInterventionFilter
  limit?: number
}): HumanInterventionsResponse {
  const seen = new Set<string>()
  const merged: HumanIntervention[] = []

  for (const item of input.inbox_items) {
    const intervention = interventionFromInboxItem(item)
    if (seen.has(intervention.intervention_id)) continue
    seen.add(intervention.intervention_id)
    merged.push(intervention)
  }

  if (input.campaign_readiness) {
    for (const intervention of interventionsFromCampaignReadiness(input.campaign_readiness)) {
      if (seen.has(intervention.intervention_id)) continue
      seen.add(intervention.intervention_id)
      merged.push(intervention)
    }
  }

  const filtered = filterHumanInterventions(merged, input.filter ?? "all")
  const ranked = rankHumanInterventions(filtered)
  const limited = ranked.slice(0, input.limit ?? 50)

  return {
    qa_marker: HUMAN_INTERVENTION_QA_MARKER,
    generated_at: new Date().toISOString(),
    total: limited.length,
    urgent_count: limited.filter((item) => item.priority === "urgent" || item.priority === "high").length,
    type_counts: countByType(limited),
    interventions: limited,
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }
}
