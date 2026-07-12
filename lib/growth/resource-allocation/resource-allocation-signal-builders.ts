/**
 * SV1-1 — Map existing lead / runtime signals into facade inputs.
 * Does not recompute qualification, budgets, or admission.
 */

import { isProspectResearchStale } from "@/lib/growth/research/growth-lead-research-readiness"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import type { GrowthLead } from "@/lib/growth/types"
import type {
  AiOsResourceAllocationAdmissionSignal,
  AiOsResourceAllocationSupportingSignals,
} from "@/lib/growth/resource-allocation/resource-allocation-types"

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function buildAdmissionSignalFromLeadMetadata(
  metadata: Record<string, unknown> | null | undefined,
): AiOsResourceAllocationAdmissionSignal {
  const state = resolveLeadAdmissionStateFromMetadata(metadata ?? {})
  const raw = asRecord(metadata)
  const allowAuto =
    typeof raw?.allow_auto_research === "boolean"
      ? raw.allow_auto_research
      : typeof raw?.admission_allow_auto_research === "boolean"
        ? (raw.admission_allow_auto_research as boolean)
        : null
  const requiresReview =
    typeof raw?.requires_human_review === "boolean"
      ? raw.requires_human_review
      : state === "review"
        ? true
        : null

  return {
    state: state ?? "unknown",
    allowAutoResearch: allowAuto,
    requiresHumanReview: requiresReview,
  }
}

export function buildResourceAllocationSignalsFromLead(
  lead: Pick<
    GrowthLead,
    | "metadata"
    | "status"
    | "prospectRecommendedNextAction"
    | "nextBestAction"
    | "lastProspectResearchedAt"
    | "latestProspectResearchRunId"
    | "score"
  >,
  overrides?: Partial<AiOsResourceAllocationSupportingSignals>,
): AiOsResourceAllocationSupportingSignals {
  const metadata = lead.metadata ?? {}
  const admission = buildAdmissionSignalFromLeadMetadata(metadata)
  const hasUsableResearch = Boolean(lead.latestProspectResearchRunId && lead.lastProspectResearchedAt)
  const researchStale = lead.lastProspectResearchedAt
    ? isProspectResearchStale(lead.lastProspectResearchedAt)
    : true
  const researchFresh = hasUsableResearch && !researchStale

  const evidenceConfidence =
    typeof lead.score === "number" && Number.isFinite(lead.score)
      ? Math.max(0, Math.min(1, lead.score > 1 ? lead.score / 100 : lead.score))
      : null

  const qualificationRecommendation =
    lead.prospectRecommendedNextAction ??
    (typeof lead.nextBestAction === "string" ? lead.nextBestAction : null) ??
    (lead.status === "disqualified" || lead.status === "archived" ? "abandon" : null)

  const stopFromStatus = lead.status === "disqualified" || lead.status === "archived"

  return {
    admission,
    qualificationRecommendation,
    evidenceConfidence,
    researchFresh,
    researchStale,
    hasUsableResearch,
    stopConditionActive: stopFromStatus,
    stopConditionReason: stopFromStatus ? `Lead status ${lead.status} is a stop condition.` : null,
    ...(overrides ?? {}),
  }
}
