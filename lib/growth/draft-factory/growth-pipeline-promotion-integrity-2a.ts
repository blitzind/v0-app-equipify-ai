/**
 * GE-AIOS-REVENUE-2A — Canonical promotion integrity (client-safe).
 * Diagnostics only — does not duplicate enforcement gates.
 */

import type { AiOsDraftFactoryDurableStage } from "@/lib/growth/draft-factory/draft-factory-durable-types"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import type { GrowthLeadAdmissionState } from "@/lib/growth/revenue-workflow/growth-lead-admission-types"

export const GROWTH_PIPELINE_PROMOTION_INTEGRITY_2A_QA_MARKER =
  "ge-aios-revenue-2a-pipeline-promotion-integrity-v1" as const

export type GrowthPipelinePromotionBoundary =
  | "decision_maker"
  | "package"
  | "outbound"

export type GrowthPipelinePromotionIntegrityViolation =
  | "rejected_entered_decision_maker"
  | "rejected_entered_package"
  | "review_entered_package"
  | "review_entered_outbound"
  | "decision_maker_without_canonical_admission"
  | "package_without_canonical_admission"
  | "outbound_without_canonical_admission"

export type GrowthPipelinePromotionIntegrityResult = {
  qaMarker: typeof GROWTH_PIPELINE_PROMOTION_INTEGRITY_2A_QA_MARKER
  ok: boolean
  boundary: GrowthPipelinePromotionBoundary
  admissionState: GrowthLeadAdmissionState | null
  violation: GrowthPipelinePromotionIntegrityViolation | null
  diagnostic: string | null
}

/** Canonical admission for downstream scarce work — accepted only; review is not admitted. */
export function resolveCanonicalAdmissionAcceptedFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return resolveLeadAdmissionStateFromMetadata(metadata) === "accepted"
}

export function resolveDraftFactoryAdmittedFromLeadMetadata(
  metadata: Record<string, unknown> | null | undefined,
): {
  admissionState: GrowthLeadAdmissionState | null
  admitted: boolean
  rejected: boolean
  failed: boolean
} {
  const admissionState = resolveLeadAdmissionStateFromMetadata(metadata)
  const admitted = admissionState === "accepted"
  const rejected = admissionState === "rejected" || admissionState === "invalid"
  const failed = rejected
  return { admissionState, admitted, rejected, failed }
}

export function evaluateGrowthPipelinePromotionIntegrity(input: {
  metadata: Record<string, unknown> | null | undefined
  boundary: GrowthPipelinePromotionBoundary
}): GrowthPipelinePromotionIntegrityResult {
  const admissionState = resolveLeadAdmissionStateFromMetadata(input.metadata)
  const base = {
    qaMarker: GROWTH_PIPELINE_PROMOTION_INTEGRITY_2A_QA_MARKER,
    boundary: input.boundary,
    admissionState,
    violation: null as GrowthPipelinePromotionIntegrityViolation | null,
    diagnostic: null as string | null,
  }

  if (input.boundary === "decision_maker") {
    if (admissionState === "rejected" || admissionState === "invalid") {
      return {
        ...base,
        ok: false,
        violation: "rejected_entered_decision_maker",
        diagnostic: "Rejected lead cannot enter Decision Maker.",
      }
    }
    if (admissionState !== "accepted") {
      return {
        ...base,
        ok: false,
        violation: "decision_maker_without_canonical_admission",
        diagnostic: "Decision Maker requires canonical admission accepted.",
      }
    }
    return { ...base, ok: true }
  }

  if (input.boundary === "package") {
    if (admissionState === "rejected" || admissionState === "invalid") {
      return {
        ...base,
        ok: false,
        violation: "rejected_entered_package",
        diagnostic: "Rejected lead cannot enter Package generation.",
      }
    }
    if (admissionState === "review") {
      return {
        ...base,
        ok: false,
        violation: "review_entered_package",
        diagnostic: "Review lead cannot enter Package generation.",
      }
    }
    if (admissionState !== "accepted") {
      return {
        ...base,
        ok: false,
        violation: "package_without_canonical_admission",
        diagnostic: "Package requires canonical admission accepted.",
      }
    }
    return { ...base, ok: true }
  }

  // outbound
  if (admissionState === "review") {
    return {
      ...base,
      ok: false,
      violation: "review_entered_outbound",
      diagnostic: "Review lead cannot enter Outbound.",
    }
  }
  if (admissionState !== "accepted") {
    return {
      ...base,
      ok: false,
      violation: "outbound_without_canonical_admission",
      diagnostic: "Outbound requires canonical admission accepted.",
    }
  }
  return { ...base, ok: true }
}

export type GrowthPipelinePromotionIntegrityAssertionInput = {
  organizationId: string
  leadId: string
  metadata: Record<string, unknown> | null | undefined
  boundary: GrowthPipelinePromotionBoundary
  stage?: AiOsDraftFactoryDurableStage | null
}

export type GrowthPipelinePromotionIntegrityAssertion = GrowthPipelinePromotionIntegrityResult & {
  organizationId: string
  leadId: string
  stage: AiOsDraftFactoryDurableStage | null
  blocked: boolean
}

/** Fail-safe diagnostic assertion — returns violation details; caller decides defer/block. */
export function assertGrowthPipelinePromotionIntegrity(
  input: GrowthPipelinePromotionIntegrityAssertionInput,
): GrowthPipelinePromotionIntegrityAssertion {
  const result = evaluateGrowthPipelinePromotionIntegrity({
    metadata: input.metadata,
    boundary: input.boundary,
  })
  return {
    ...result,
    organizationId: input.organizationId,
    leadId: input.leadId,
    stage: input.stage ?? null,
    blocked: !result.ok,
  }
}
