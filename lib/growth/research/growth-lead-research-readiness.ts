/** GE-AIOS-21A / GE-AIOS-21C — Lead research readiness (client-safe, no duplicate status system). */

import {
  isConsumerEmailDomain,
  normalizeDomain,
} from "@/lib/growth/company-identification/company-identification-normalize"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"

import type { GrowthLeadResearchWorkflowStatus } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import type { GrowthLead } from "@/lib/growth/types"
import type { GrowthResearchRunStatus } from "@/lib/growth/research/research-types"

export const GROWTH_LEAD_RESEARCH_READINESS_21A_QA_MARKER =
  "ge-aios-21a-deep-autonomous-company-research-v1" as const

/** Stale prospect research after 30 days (aligned with prospect-search contact freshness). */
export const GROWTH_LEAD_PROSPECT_RESEARCH_STALE_DAYS = 30

export type GrowthLeadCustomerResearchState =
  | "not_started"
  | "researching"
  | "researched"
  | "stale"
  | "failed"
  | "insufficient_evidence"

export function hasUsableProspectResearch(
  lastProspectResearchedAt: string | null | undefined,
  latestProspectResearchRunId: string | null | undefined,
): boolean {
  return Boolean(lastProspectResearchedAt?.trim() && latestProspectResearchRunId?.trim())
}

export function hasUsableLeadResearch(input: {
  lastResearchedAt?: string | null
  latestResearchRunId?: string | null
  lastProspectResearchedAt?: string | null
  latestProspectResearchRunId?: string | null
}): boolean {
  if (input.lastResearchedAt?.trim() && input.latestResearchRunId?.trim()) return true
  return hasUsableProspectResearch(input.lastProspectResearchedAt, input.latestProspectResearchRunId)
}

export function isProspectResearchStale(
  lastProspectResearchedAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!lastProspectResearchedAt?.trim()) return false
  const parsed = Date.parse(lastProspectResearchedAt)
  if (Number.isNaN(parsed)) return false
  const ageDays = (now.getTime() - parsed) / (24 * 60 * 60 * 1000)
  return ageDays > GROWTH_LEAD_PROSPECT_RESEARCH_STALE_DAYS
}

export function resolveProspectRunResearchState(
  runStatus: GrowthResearchRunStatus | null | undefined,
): GrowthLeadCustomerResearchState {
  switch (runStatus) {
    case "queued":
    case "running":
      return "researching"
    case "completed":
      return "researched"
    case "failed":
      return "failed"
    default:
      return "not_started"
  }
}

export function mapWorkflowStatusToCustomerResearchState(
  workflowStatus: GrowthLeadResearchWorkflowStatus | null | undefined,
  input?: {
    lastProspectResearchedAt?: string | null
    latestProspectResearchRunId?: string | null
    prospectRunStatus?: GrowthResearchRunStatus | null
    website?: string | null
  },
): GrowthLeadCustomerResearchState {
  if (input?.prospectRunStatus === "queued" || input?.prospectRunStatus === "running") {
    return "researching"
  }
  if (input?.prospectRunStatus === "failed") return "failed"

  switch (workflowStatus) {
    case "researching":
    case "scheduled":
      return "researching"
    case "research_complete":
    case "qualified":
    case "assessed":
      if (isProspectResearchStale(input?.lastProspectResearchedAt)) return "stale"
      return "researched"
    case "failed":
    case "blocked":
      return "failed"
    case "not_started":
    default:
      break
  }

  if (hasUsableProspectResearch(input?.lastProspectResearchedAt, input?.latestProspectResearchRunId)) {
    if (isProspectResearchStale(input?.lastProspectResearchedAt)) return "stale"
    return "researched"
  }

  if (!input?.website?.trim()) return "insufficient_evidence"
  return "not_started"
}

export function shouldAutoQueueLeadResearch(lead: Pick<
  GrowthLead,
  | "website"
  | "status"
  | "lastProspectResearchedAt"
  | "latestProspectResearchRunId"
  | "lastResearchedAt"
  | "latestResearchRunId"
  | "metadata"
>): boolean {
  if (lead.status === "disqualified" || lead.status === "archived" || lead.status === "converted") {
    return false
  }

  const admissionState = resolveLeadAdmissionStateFromMetadata(lead.metadata)
  if (admissionState === "invalid" || admissionState === "rejected") {
    return false
  }
  if (admissionState === "review") {
    const domain = normalizeDomain(lead.website)
    if (!domain) return false
  }

  const websiteDomain = normalizeDomain(lead.website)
  if (websiteDomain && isConsumerEmailDomain(websiteDomain)) {
    return false
  }

  if (!lead.website?.trim()) return false
  if (hasUsableLeadResearch(lead) && !isProspectResearchStale(lead.lastProspectResearchedAt)) {
    return false
  }
  return true
}

export function resolveCustomerResearchStateLabel(state: GrowthLeadCustomerResearchState): string {
  switch (state) {
    case "not_started":
      return "Not started"
    case "researching":
      return "Researching"
    case "researched":
      return "Research complete"
    case "stale":
      return "Stale — refresh recommended"
    case "failed":
      return "Research failed"
    case "insufficient_evidence":
      return "Insufficient evidence — add a website"
    default:
      return "Not started"
  }
}

export function resolveCustomerResearchProgressMessage(state: GrowthLeadCustomerResearchState): string | null {
  switch (state) {
    case "researching":
      return "Ava is researching this company…"
    case "not_started":
      return "Ava will research this company automatically."
    case "insufficient_evidence":
      return "Add a company website so Ava can gather public intelligence."
    case "failed":
      return "Research did not complete — Ava can retry automatically."
    case "stale":
      return "Research is aging — Ava will refresh when queued."
    default:
      return null
  }
}
