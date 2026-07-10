/** GE-AIOS-21C-4 — Legacy lead cleanup plan (client-safe, uses canonical evaluator). */

import { isConsumerEmailDomain, normalizeDomain } from "@/lib/growth/company-identification/company-identification-normalize"
import {
  evaluateGrowthLeadAdmission,
  type GrowthLeadAdmissionContext,
} from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import {
  classifyGrowthLeadAdmissionDrift,
  type GrowthLeadAdmissionDriftClassification,
} from "@/lib/growth/revenue-workflow/growth-lead-admission-drift"
import {
  buildGrowthLeadAdmissionIntakeFromLead,
  type GrowthLeadAdmissionLeadRow,
} from "@/lib/growth/revenue-workflow/growth-lead-admission-lead-input"
import type { GrowthLeadAdmissionState } from "@/lib/growth/revenue-workflow/growth-lead-admission-types"

export const GE_AIOS_21C_LEGACY_CLEANUP_SCRIPT_ID =
  "cleanup-ge-aios-21c-legacy-leads-production" as const

export const GE_AIOS_21C_LEGACY_CLEANUP_CONFIRM_TOKEN = "GE_AIOS_21C_LEGACY_CLEANUP" as const

export type GrowthLeadAdmissionCleanupProposedAction = {
  leadId: string
  companyName: string | null
  currentStatus: string
  evaluatedState: GrowthLeadAdmissionState
  driftClassification: GrowthLeadAdmissionDriftClassification
  proposedChanges: string[]
  idempotent: boolean
}

function websiteNeedsCleanup(currentWebsite: string | null | undefined): boolean {
  const domain = normalizeDomain(currentWebsite)
  return Boolean(domain && isConsumerEmailDomain(domain))
}

export function buildGrowthLeadAdmissionCleanupPlan(input: {
  lead: GrowthLeadAdmissionLeadRow & { status: string }
  admissionContext: GrowthLeadAdmissionContext
  suppressed?: boolean
}): GrowthLeadAdmissionCleanupProposedAction {
  const metadata =
    input.lead.metadata && typeof input.lead.metadata === "object" ? input.lead.metadata : {}
  const intake = buildGrowthLeadAdmissionIntakeFromLead(input.lead)
  const evaluation = evaluateGrowthLeadAdmission(intake, input.admissionContext)
  const storedState =
    typeof metadata.admission_state === "string" ? metadata.admission_state : null
  const drift = classifyGrowthLeadAdmissionDrift({
    storedState: storedState as GrowthLeadAdmissionState | null,
    evaluation,
    currentWebsite: input.lead.website,
    currentCompanyName: input.lead.company_name,
    status: input.lead.status,
    suppressed: input.suppressed,
  })

  const proposedChanges: string[] = []
  if (evaluation.state !== storedState) {
    proposedChanges.push(`admission_state → ${evaluation.state}`)
  }
  if (websiteNeedsCleanup(input.lead.website)) {
    proposedChanges.push("clear consumer-domain website")
  }
  if (
    evaluation.state === "invalid" &&
    input.lead.company_name &&
    isConsumerEmailDomain(normalizeDomain(input.lead.company_name))
  ) {
    proposedChanges.push(`company_name → ${evaluation.sanitized.companyName}`)
  }
  if (evaluation.state === "rejected" || evaluation.state === "invalid") {
    if (input.lead.status !== "disqualified") proposedChanges.push("status → disqualified")
    proposedChanges.push("suppress from active queues")
    proposedChanges.push("disable autonomous research")
    proposedChanges.push("disable outreach eligibility")
  }
  if (evaluation.state === "review") {
    proposedChanges.push("requires_human_review → true")
    if (!evaluation.allowAutoResearch) proposedChanges.push("disable autonomous research")
  }
  if (evaluation.state === "accepted" && !storedState) {
    proposedChanges.push("add admission metadata")
  }

  const idempotent =
    proposedChanges.length === 0 ||
    (storedState === evaluation.state &&
      !websiteNeedsCleanup(input.lead.website) &&
      (evaluation.state !== "rejected" && evaluation.state !== "invalid"
        ? true
        : input.lead.status === "disqualified"))

  return {
    leadId: input.lead.id,
    companyName: input.lead.company_name,
    currentStatus: input.lead.status,
    evaluatedState: evaluation.state,
    driftClassification: drift.driftClassification,
    proposedChanges,
    idempotent,
  }
}

export function websiteNeedsAdmissionIdentityCleanup(
  currentWebsite: string | null | undefined,
): boolean {
  return websiteNeedsCleanup(currentWebsite)
}
