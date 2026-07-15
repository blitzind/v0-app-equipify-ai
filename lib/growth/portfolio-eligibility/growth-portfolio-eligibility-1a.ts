/**
 * GE-AIOS-PORTFOLIO-ELIGIBILITY-CLOSURE-1A — Canonical autonomous portfolio eligibility (client-safe).
 */

import type { GrowthCanonicalLeadLifecycleSnapshot } from "@/lib/growth/aios/execution/growth-canonical-execution-authority-1a"
import { inferHardTerminalReasonFromLeadLifecycle } from "@/lib/growth/aios/execution/growth-terminal-reason-taxonomy-1a"
import {
  GROWTH_PORTFOLIO_ELIGIBILITY_1A_QA_MARKER,
  type GrowthPortfolioEligibilityContext,
  type GrowthPortfolioEligibilityExclusionReason,
  type GrowthPortfolioEligibilityLeadRecord,
  type GrowthPortfolioEligibilityResult,
} from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a-types"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import type { GrowthLead } from "@/lib/growth/types"
import type { GrowthAvaResearchLoopSummary } from "@/lib/growth/ava-home/growth-ava-research-orchestrator-types"
import { extractLeadIdFromWorkItem } from "@/lib/growth/specialists/execution/extract-lead-id-from-work-item"
import type { AvaWorkItem } from "@/lib/growth/work-manager/types"

function asLeadRecord(lead: GrowthLead | GrowthPortfolioEligibilityLeadRecord): GrowthPortfolioEligibilityLeadRecord {
  return lead
}

export function buildPortfolioLifecycleSnapshotFromLead(
  lead: GrowthPortfolioEligibilityLeadRecord,
): GrowthCanonicalLeadLifecycleSnapshot {
  const metadata = lead.metadata ?? {}
  return {
    status: lead.status,
    archivedAt: lead.archivedAt ?? null,
    admissionState: resolveLeadAdmissionStateFromMetadata(metadata) ?? null,
    suppressed:
      lead.workflowHealth === "blocked" &&
      /suppress|unsub|compliance/i.test(lead.workflowHealthReason ?? String(metadata.suppression_reason ?? "")),
    suppressionReason:
      typeof metadata.suppression_reason === "string" ? metadata.suppression_reason : lead.workflowHealthReason ?? null,
    opportunityStage:
      typeof metadata.opportunity_stage === "string" ? metadata.opportunity_stage : null,
    expansionWorkflowActive: Boolean(metadata.expansion_workflow_active),
  }
}

function resolveHardTerminalExclusionReason(
  reason: ReturnType<typeof inferHardTerminalReasonFromLeadLifecycle>,
): GrowthPortfolioEligibilityExclusionReason | null {
  if (!reason) return null
  switch (reason) {
    case "archived":
      return "hard_terminal_archived"
    case "disqualified":
      return "hard_terminal_disqualified"
    case "invalid":
      return "hard_terminal_invalid"
    case "duplicate":
      return "hard_terminal_duplicate"
    case "company_closed":
      return "hard_terminal_company_closed"
    case "closed_won":
      return "hard_terminal_closed_won"
    case "closed_lost":
      return "hard_terminal_closed_lost"
    case "converted_customer":
      return "hard_terminal_converted_customer"
    case "unsubscribed":
      return "hard_terminal_unsubscribed"
    case "compliance_suppressed":
      return "hard_terminal_compliance_suppressed"
    default:
      return "lead_status_terminal"
  }
}

export function isLeadInPortfolioOrganizationScope(
  lead: GrowthPortfolioEligibilityLeadRecord,
  organizationId: string,
): boolean {
  const promoted = lead.promotedOrganizationId?.trim()
  if (promoted && promoted !== organizationId) return false

  const metadata = lead.metadata ?? {}
  const metaOrg =
    (typeof metadata.organization_id === "string" && metadata.organization_id.trim()) ||
    (typeof metadata.growth_organization_id === "string" && metadata.growth_organization_id.trim()) ||
    null
  if (metaOrg && metaOrg !== organizationId) return false

  return true
}

export function evaluateGrowthPortfolioLeadEligibility(input: {
  lead: GrowthLead | GrowthPortfolioEligibilityLeadRecord
  organizationId: string
}): GrowthPortfolioEligibilityResult {
  const lead = asLeadRecord(input.lead)

  if (!isLeadInPortfolioOrganizationScope(lead, input.organizationId)) {
    return {
      qaMarker: GROWTH_PORTFOLIO_ELIGIBILITY_1A_QA_MARKER,
      eligible: false,
      excludedBeforeRanking: true,
      reasonCode: "wrong_organization_scope",
    }
  }

  const lifecycle = buildPortfolioLifecycleSnapshotFromLead(lead)
  const hardTerminal = inferHardTerminalReasonFromLeadLifecycle(lifecycle)
  const hardTerminalReason = resolveHardTerminalExclusionReason(hardTerminal)
  if (hardTerminalReason) {
    return {
      qaMarker: GROWTH_PORTFOLIO_ELIGIBILITY_1A_QA_MARKER,
      eligible: false,
      excludedBeforeRanking: true,
      reasonCode: hardTerminalReason,
    }
  }

  const admission = resolveLeadAdmissionStateFromMetadata(lead.metadata)
  if (admission === "invalid") {
    return {
      qaMarker: GROWTH_PORTFOLIO_ELIGIBILITY_1A_QA_MARKER,
      eligible: false,
      excludedBeforeRanking: true,
      reasonCode: "admission_invalid",
    }
  }
  if (admission === "rejected") {
    return {
      qaMarker: GROWTH_PORTFOLIO_ELIGIBILITY_1A_QA_MARKER,
      eligible: false,
      excludedBeforeRanking: true,
      reasonCode: "admission_rejected",
    }
  }
  if (admission === "review") {
    return {
      qaMarker: GROWTH_PORTFOLIO_ELIGIBILITY_1A_QA_MARKER,
      eligible: false,
      excludedBeforeRanking: true,
      reasonCode: "admission_review",
    }
  }

  const status = lead.status?.trim().toLowerCase() ?? ""
  if (status === "archived" || status === "disqualified" || status === "duplicate") {
    return {
      qaMarker: GROWTH_PORTFOLIO_ELIGIBILITY_1A_QA_MARKER,
      eligible: false,
      excludedBeforeRanking: true,
      reasonCode: "lead_status_terminal",
    }
  }

  return {
    qaMarker: GROWTH_PORTFOLIO_ELIGIBILITY_1A_QA_MARKER,
    eligible: true,
    excludedBeforeRanking: false,
    reasonCode: null,
  }
}

export function filterPortfolioEligibleLeads<T extends GrowthLead | GrowthPortfolioEligibilityLeadRecord>(
  leads: T[],
  organizationId: string,
): T[] {
  return leads.filter(
    (lead) => evaluateGrowthPortfolioLeadEligibility({ lead, organizationId }).eligible,
  )
}

export function buildPortfolioEligibilityContext(
  organizationId: string,
  leads: Array<GrowthLead | GrowthPortfolioEligibilityLeadRecord>,
): GrowthPortfolioEligibilityContext {
  const eligible = filterPortfolioEligibleLeads(leads, organizationId)
  return {
    qaMarker: GROWTH_PORTFOLIO_ELIGIBILITY_1A_QA_MARKER,
    organizationId,
    eligibleLeadIds: new Set(eligible.map((lead) => lead.id)),
    eligibleCount: eligible.length,
    excludedCount: Math.max(0, leads.length - eligible.length),
  }
}

export function sanitizeResearchLoopSummaryForPortfolio(
  summary: GrowthAvaResearchLoopSummary | null,
  eligibility: GrowthPortfolioEligibilityContext | null,
): GrowthAvaResearchLoopSummary | null {
  if (!summary || !eligibility) return summary

  const leadResults = (summary.leadResults ?? []).filter((row) => eligibility.eligibleLeadIds.has(row.leadId))
  if (leadResults.length === (summary.leadResults ?? []).length) return summary

  return {
    ...summary,
    leadResults,
    companiesReviewed: leadResults.length,
    researchCompleted: leadResults.filter((row) => row.outcome === "completed").length,
    readyForOutreachReview: leadResults.filter((row) => row.readyForOutreachReview).length,
    qualificationCompleted: leadResults.filter((row) => row.qualificationStatus === "completed").length,
  }
}

const NON_LEAD_EXECUTABLE_TYPES = new Set([
  "mission",
  "business_understanding",
  "wait",
  "approval",
])

export function isPortfolioEligibleWorkItem(
  item: AvaWorkItem,
  eligibility: GrowthPortfolioEligibilityContext | null,
): boolean {
  if (!eligibility) return true
  if (NON_LEAD_EXECUTABLE_TYPES.has(item.type)) return true

  const leadId = extractLeadIdFromWorkItem(item)
  if (!leadId) return false
  return eligibility.eligibleLeadIds.has(leadId)
}

export function filterPortfolioEligibleWorkItems(
  items: AvaWorkItem[],
  eligibility: GrowthPortfolioEligibilityContext | null,
): AvaWorkItem[] {
  if (!eligibility) return items
  return items.filter((item) => isPortfolioEligibleWorkItem(item, eligibility))
}

export function applyPortfolioEligibilityToWorkManagerResult(
  result: import("@/lib/growth/work-manager/types").AvaWorkManagerResult,
  eligibility: GrowthPortfolioEligibilityContext | null,
): import("@/lib/growth/work-manager/types").AvaWorkManagerResult {
  if (!eligibility) return result

  const allowedIds = new Set<string>()
  const all_work_items = filterPortfolioEligibleWorkItems(result.all_work_items, eligibility)
  for (const item of all_work_items) allowedIds.add(item.id)

  const active_work =
    result.active_work && allowedIds.has(result.active_work.id) ? result.active_work : null
  const work_plan = result.work_plan.filter((entry) => allowedIds.has(entry.work_item_id))
  const operator_queue = result.operator_queue.filter((item) => allowedIds.has(item.id))
  const blocked = result.blocked.filter((item) => allowedIds.has(item.id))
  const deferred = result.deferred.filter((item) => allowedIds.has(item.id))
  const completed_today = result.completed_today

  return {
    ...result,
    active_work,
    work_plan,
    operator_queue,
    blocked,
    deferred,
    all_work_items,
    completed_today,
  }
}
