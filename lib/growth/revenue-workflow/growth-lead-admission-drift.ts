/** GE-AIOS-21C-4 — Admission drift classification (client-safe, read-only). */

import type { GrowthLeadAdmissionEvaluation } from "@/lib/growth/revenue-workflow/growth-lead-admission-types"
import type { GrowthLeadAdmissionState } from "@/lib/growth/revenue-workflow/growth-lead-admission-types"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"

export const GROWTH_LEAD_ADMISSION_DRIFT_CLASSIFICATIONS = [
  "unchanged",
  "metadata_missing",
  "should_accept",
  "should_review",
  "should_reject",
  "should_invalidate",
  "identity_cleanup_required",
  "queue_suppression_required",
  "research_suppression_required",
] as const

export type GrowthLeadAdmissionDriftClassification =
  (typeof GROWTH_LEAD_ADMISSION_DRIFT_CLASSIFICATIONS)[number]

export type GrowthLeadAdmissionDriftRow = {
  leadId: string
  companyName: string
  storedState: GrowthLeadAdmissionState | null
  evaluatedState: GrowthLeadAdmissionState
  reasons: string[]
  proposedAction: string
  driftClassification: GrowthLeadAdmissionDriftClassification
  queueMembership: "active" | "suppressed" | "disqualified"
  researchEligibility: boolean
  outreachEligibility: boolean
}

export function resolveLeadQueueMembership(input: {
  status?: string | null
  suppressed?: boolean
}): GrowthLeadAdmissionDriftRow["queueMembership"] {
  if (input.status === "disqualified" || input.status === "archived") return "disqualified"
  if (input.suppressed) return "suppressed"
  return "active"
}

export function resolveOutreachEligibility(input: {
  evaluation: GrowthLeadAdmissionEvaluation
  status?: string | null
  suppressed?: boolean
}): boolean {
  if (input.status === "disqualified" || input.status === "archived" || input.status === "converted") {
    return false
  }
  if (input.suppressed) return false
  if (input.evaluation.state === "invalid" || input.evaluation.state === "rejected") return false
  if (input.evaluation.state === "review") return false
  return true
}

export function classifyGrowthLeadAdmissionDrift(input: {
  storedState: GrowthLeadAdmissionState | null
  evaluation: GrowthLeadAdmissionEvaluation
  currentWebsite?: string | null
  currentCompanyName?: string | null
  status?: string | null
  suppressed?: boolean
}): GrowthLeadAdmissionDriftRow {
  const { evaluation } = input
  const evaluatedState = evaluation.state
  const storedState = input.storedState
  const reasons = evaluation.reasons

  let driftClassification: GrowthLeadAdmissionDriftClassification = "unchanged"
  let proposedAction = "No change"

  if (!storedState) {
    driftClassification = "metadata_missing"
    proposedAction = `Add admission metadata (${evaluatedState})`
  } else if (storedState !== evaluatedState) {
    if (evaluatedState === "accepted") driftClassification = "should_accept"
    else if (evaluatedState === "review") driftClassification = "should_review"
    else if (evaluatedState === "rejected") driftClassification = "should_reject"
    else driftClassification = "should_invalidate"
    proposedAction = `Update admission_state ${storedState} → ${evaluatedState}`
  }

  const websiteNeedsCleanup =
    Boolean(input.currentWebsite?.trim()) &&
    (evaluation.sanitized.website ?? null) !== (input.currentWebsite?.trim() ?? null)
  const nameNeedsCleanup =
    Boolean(input.currentCompanyName?.trim()) &&
    evaluation.sanitized.companyName !== input.currentCompanyName?.trim()

  if (
    evaluatedState === "invalid" &&
    (websiteNeedsCleanup || nameNeedsCleanup)
  ) {
    driftClassification = "identity_cleanup_required"
    proposedAction = "Clear consumer-domain website/name; preserve contact email"
  }

  const queueMembership = resolveLeadQueueMembership({
    status: input.status,
    suppressed: input.suppressed,
  })
  const researchEligibility = evaluation.allowAutoResearch
  const outreachEligibility = resolveOutreachEligibility({
    evaluation,
    status: input.status,
    suppressed: input.suppressed,
  })

  if (
    (evaluatedState === "invalid" || evaluatedState === "rejected") &&
    queueMembership === "active"
  ) {
    driftClassification = "queue_suppression_required"
    proposedAction = "Disqualify and suppress from active work queues"
  }

  if (
    (evaluatedState === "invalid" || evaluatedState === "rejected" || evaluatedState === "review") &&
    researchEligibility === false &&
    storedState !== evaluatedState
  ) {
    if (driftClassification === "unchanged") {
      driftClassification = "research_suppression_required"
      proposedAction = "Ensure autonomous research remains blocked"
    }
  }

  if (storedState === evaluatedState && !websiteNeedsCleanup && !nameNeedsCleanup && storedState) {
    driftClassification = "unchanged"
    proposedAction = "No change"
  }

  return {
    leadId: "",
    companyName: evaluation.sanitized.companyName,
    storedState,
    evaluatedState,
    reasons,
    proposedAction,
    driftClassification,
    queueMembership,
    researchEligibility,
    outreachEligibility,
  }
}

export function resolveStoredAdmissionState(
  metadata: Record<string, unknown> | null | undefined,
): GrowthLeadAdmissionState | null {
  return resolveLeadAdmissionStateFromMetadata(metadata)
}
