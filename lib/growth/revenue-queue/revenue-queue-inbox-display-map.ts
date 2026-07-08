/** GE-LEADS-CANONICAL-3A — Map growth.leads fields to inbox-compatible queue display (client-safe). */

import type { GrowthLeadInboxStatus } from "@/lib/growth/lead-inbox/lead-inbox-types"
import type { GrowthLead, GrowthLeadResearchPriority, GrowthLeadStatus } from "@/lib/growth/types"

export function domainFromWebsite(website: string | null | undefined): string | null {
  const raw = typeof website === "string" ? website.trim() : ""
  if (!raw) return null
  try {
    const url = raw.startsWith("http") ? raw : `https://${raw}`
    return new URL(url).hostname.replace(/^www\./, "") || null
  } catch {
    return raw.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || null
  }
}

export function mapResearchPriorityToInboxPriority(priority: GrowthLeadResearchPriority): string {
  if (priority === "critical") return "urgent"
  if (priority === "high") return "high"
  if (priority === "low") return "low"
  return "normal"
}

/** Map canonical CRM status → inbox queue status for section/KPI parity. */
export function mapLeadStatusToInboxQueueStatus(status: GrowthLeadStatus): GrowthLeadInboxStatus {
  switch (status) {
    case "new":
      return "new"
    case "researching":
    case "enriched":
      return "enriching"
    case "qualified":
    case "call_ready":
      return "approved"
    case "in_outreach":
      return "running_pipeline"
    case "replied":
    case "converted":
      return "pipeline_complete"
    case "disqualified":
      return "disqualified"
    case "archived":
      return "archived"
    default:
      return "reviewing"
  }
}

export function mapWorkflowHealthToPipelineStatus(
  workflowHealth: GrowthLead["workflowHealth"],
  queueStatus: GrowthLeadInboxStatus,
): string {
  if (queueStatus === "running_pipeline") return "running"
  if (workflowHealth === "active") return "queued"
  if (workflowHealth === "blocked") return "not_started"
  return "not_started"
}

export function deriveHumanReviewRequiredFromLead(lead: GrowthLead, queueStatus: GrowthLeadInboxStatus): boolean {
  if (lead.workflowHealth === "blocked") return true
  if (queueStatus === "new" || queueStatus === "reviewing") return true
  return false
}

export function deriveCandidateConfidenceFromLead(lead: GrowthLead): number {
  const opp = lead.opportunityReadinessConfidence
  if (typeof opp === "number" && opp > 0) return opp <= 1 ? opp : Math.min(1, opp / 100)
  const conv = lead.conversationConfidence
  if (typeof conv === "number" && conv > 0) return conv <= 1 ? conv : Math.min(1, conv / 100)
  return 0.5
}

export function deriveIntentScoreFromLead(lead: GrowthLead): number {
  if (typeof lead.score === "number" && lead.score > 0) return lead.score
  if (typeof lead.engagementScore === "number" && lead.engagementScore > 0) return lead.engagementScore
  if (typeof lead.momentumScore === "number" && lead.momentumScore > 0) return lead.momentumScore
  return 0
}

export function readLeadMetadataSummary<T extends Record<string, unknown>>(
  metadata: Record<string, unknown>,
  key: string,
): T | undefined {
  const value = metadata[key]
  return value && typeof value === "object" ? (value as T) : undefined
}
