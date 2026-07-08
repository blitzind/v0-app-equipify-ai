/** GE-LEADS-CANONICAL-3A — Section bucketing for canonical Revenue Queue (client-safe). */

import type { GrowthLeadInboxRow } from "@/lib/growth/lead-inbox/lead-inbox-types"
import { resolveInboxDashboardSection } from "@/lib/growth/lead-operator-workspace/lead-inbox-dashboard"
import type {
  GrowthLeadInboxCardView,
  GrowthLeadInboxDashboardSection,
  GrowthLeadInboxDashboardSectionPayload,
  GrowthLeadInboxSortMode,
} from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import { buildRevenueQueueCardProjectionFromLead } from "@/lib/growth/revenue-queue/revenue-queue-card-projection"
import {
  deriveCandidateConfidenceFromLead,
  deriveHumanReviewRequiredFromLead,
  deriveIntentScoreFromLead,
  domainFromWebsite,
  mapLeadStatusToInboxQueueStatus,
  mapResearchPriorityToInboxPriority,
  mapWorkflowHealthToPipelineStatus,
} from "@/lib/growth/revenue-queue/revenue-queue-inbox-display-map"
import type { GrowthLead } from "@/lib/growth/types"

const SECTION_LABELS: Record<GrowthLeadInboxDashboardSection, string> = {
  high_priority: "High Priority",
  needs_review: "Needs Review",
  enrichment_needed: "Enrichment Needed",
  approved: "Approved",
  pipeline_running: "Pipeline Running",
  archived: "Archived",
}

/** Reuse legacy section resolver by synthesizing inbox row shape from canonical lead. */
export function buildPseudoInboxRowFromGrowthLead(lead: GrowthLead): GrowthLeadInboxRow {
  const queueStatus = mapLeadStatusToInboxQueueStatus(lead.status)
  const intentScore = deriveIntentScoreFromLead(lead)
  const candidateConfidence = deriveCandidateConfidenceFromLead(lead)
  return {
    id: lead.id,
    created_at: lead.createdAt,
    updated_at: lead.updatedAt,
    site_key: lead.sourceDetail ?? lead.sourceKind,
    candidate_type: "identified",
    candidate_priority: mapResearchPriorityToInboxPriority(lead.researchPriority) as GrowthLeadInboxRow["candidate_priority"],
    intent_score: intentScore,
    intent_grade: typeof lead.metadata.intent_grade === "string" ? lead.metadata.intent_grade : "F",
    candidate_confidence: candidateConfidence,
    pipeline_entry: "icp_targeting",
    pipeline_status: mapWorkflowHealthToPipelineStatus(lead.workflowHealth, queueStatus) as GrowthLeadInboxRow["pipeline_status"],
    company_name: lead.companyName,
    domain: domainFromWebsite(lead.website),
    contact_name: lead.contactName,
    email: lead.contactEmail,
    phone: lead.contactPhone,
    linkedin_url: typeof lead.metadata.linkedin_url === "string" ? lead.metadata.linkedin_url : null,
    dedupe_hash: lead.externalRef ?? lead.id,
    candidate_reasoning: lead.notes?.trim() ? [lead.notes.trim()] : [],
    candidate_evidence: Array.isArray(lead.metadata.candidate_evidence)
      ? (lead.metadata.candidate_evidence as GrowthLeadInboxRow["candidate_evidence"])
      : [],
    candidate_attribution: lead.sourceChannel
      ? [
          {
            source: lead.sourceChannel,
            section: "canonical_lead",
            signal: lead.sourceKind,
            evidence: lead.sourceDetail ?? lead.sourceKind,
            confidence: candidateConfidence,
          },
        ]
      : [],
    session_count: typeof lead.metadata.intent_session_count === "number" ? lead.metadata.intent_session_count : 0,
    visit_count: typeof lead.metadata.intent_visit_count === "number" ? lead.metadata.intent_visit_count : 0,
    utm_source: lead.sourceChannel ?? "",
    utm_medium: "",
    utm_campaign: lead.sourceCampaign ?? "",
    owner_id: lead.assignedTo,
    status: queueStatus,
    human_review_required: deriveHumanReviewRequiredFromLead(lead, queueStatus),
    lead_engine_run_id: lead.latestResearchRunId,
    intent_session_id:
      typeof lead.metadata.intent_session_id === "string" ? lead.metadata.intent_session_id : "",
    visitor_key: typeof lead.metadata.visitor_key === "string" ? lead.metadata.visitor_key : "",
    existing_account_match: {
      matched: Boolean(lead.promotedOrganizationId),
      source: lead.promotedOrganizationId ? "growth.leads" : null,
      ids: lead.promotedOrganizationId ? [lead.promotedOrganizationId] : [],
      evidence: "",
    },
    existing_lead_match: {
      matched: true,
      source: "growth.leads",
      ids: [lead.id],
      evidence: "Canonical revenue queue lead.",
    },
    metadata: {
      ...lead.metadata,
      growth_lead_id: lead.id,
      revenue_queue_source: "canonical",
    },
  }
}

export function resolveRevenueQueueSectionFromLead(lead: GrowthLead): GrowthLeadInboxDashboardSection {
  return resolveInboxDashboardSection(buildPseudoInboxRowFromGrowthLead(lead))
}

function compareBySortMode(
  a: GrowthLeadInboxCardView,
  b: GrowthLeadInboxCardView,
  mode: GrowthLeadInboxSortMode,
): number {
  if (mode === "intent") {
    const delta = b.intent_score - a.intent_score
    if (delta !== 0) return delta
  }
  if (mode === "confidence") {
    const delta = b.candidate_confidence - a.candidate_confidence
    if (delta !== 0) return delta
  }
  if (mode === "recent_activity") {
    return new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime()
  }
  const priorityRank: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 }
  const pa = priorityRank[a.candidate_priority] ?? 2
  const pb = priorityRank[b.candidate_priority] ?? 2
  if (pa !== pb) return pa - pb
  const scoreDelta = (b.lead_score ?? b.intent_score) - (a.lead_score ?? a.intent_score)
  if (scoreDelta !== 0) return scoreDelta
  return new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime()
}

/** Build dashboard sections from canonical leads using legacy section + sort semantics. */
export function buildRevenueQueueDashboardSectionsFromLeads(
  leads: GrowthLead[],
  sort: GrowthLeadInboxSortMode = "priority",
): GrowthLeadInboxDashboardSectionPayload[] {
  const buckets = new Map<GrowthLeadInboxDashboardSection, GrowthLeadInboxCardView[]>()
  const sectionOrder: GrowthLeadInboxDashboardSection[] = [
    "high_priority",
    "needs_review",
    "enrichment_needed",
    "approved",
    "pipeline_running",
    "archived",
  ]
  for (const section of sectionOrder) buckets.set(section, [])

  for (const lead of leads) {
    const section = resolveRevenueQueueSectionFromLead(lead)
    buckets.get(section)!.push(buildRevenueQueueCardProjectionFromLead(lead))
  }

  return sectionOrder.map((id) => {
    const items = [...(buckets.get(id) ?? [])].sort((a, b) => compareBySortMode(a, b, sort))
    return { id, label: SECTION_LABELS[id], items }
  })
}
