/**
 * GE-AIOS-REVENUE-2A-HOTFIX-1 — Admission downstream reconcile batch planner (client-safe).
 * Reuses integrity evaluator — no new scheduler, worker, or queue.
 */

import type { AiOsDraftFactoryDurableState } from "@/lib/growth/draft-factory/draft-factory-durable-types"
import {
  evaluateGrowthPipelinePromotionIntegrity,
  type GrowthPipelinePromotionIntegrityViolation,
} from "@/lib/growth/draft-factory/growth-pipeline-promotion-integrity-2a"
import { REVENUE_PROMOTION_RECONCILE_LIMIT_PER_ORG } from "@/lib/growth/draft-factory/draft-factory-wake-event-types"
import type { GrowthLeadAdmissionState } from "@/lib/growth/revenue-workflow/growth-lead-admission-types"

export const GROWTH_REVENUE_2A_HOTFIX_1_QA_MARKER =
  "ge-aios-revenue-2a-hotfix-1-admission-reconcile-v1" as const

export { REVENUE_PROMOTION_RECONCILE_LIMIT_PER_ORG }

/** Durable states that must not host rejected/review admission under canonical truth. */
export const GROWTH_REVENUE_2A_DOWNSTREAM_RECONCILE_STATES = new Set<
  AiOsDraftFactoryDurableState | string
>([
  "waiting_for_dm",
  "waiting_for_contact_verification",
  "waiting_for_personalization",
  "waiting_for_generation",
  "draft_ready",
])

export type AdmissionDownstreamReconcileDueRow = {
  leadId: string
  state: AiOsDraftFactoryDurableState | string
  updatedAt: string
}

export type AdmissionDownstreamReconcileCandidate = AdmissionDownstreamReconcileDueRow & {
  admissionState: GrowthLeadAdmissionState | null
  dmViolation: GrowthPipelinePromotionIntegrityViolation | null
  packageViolation: GrowthPipelinePromotionIntegrityViolation | null
}

export type AdmissionDownstreamReconcilePlan = {
  qaMarker: typeof GROWTH_REVENUE_2A_HOTFIX_1_QA_MARKER
  limit: number
  downstreamFound: number
  integrityViolations: number
  skippedAlreadyCorrect: number
  skippedMissingMetadata: number
  candidates: AdmissionDownstreamReconcileCandidate[]
  remainingAfterCap: number
}

export function isAdmissionDownstreamReconcileState(
  state: AiOsDraftFactoryDurableState | string,
): boolean {
  return GROWTH_REVENUE_2A_DOWNSTREAM_RECONCILE_STATES.has(state)
}

export function evaluateAdmissionDownstreamReconcileNeed(input: {
  metadata: Record<string, unknown> | null | undefined
}): {
  needsReconcile: boolean
  dmViolation: GrowthPipelinePromotionIntegrityViolation | null
  packageViolation: GrowthPipelinePromotionIntegrityViolation | null
  admissionState: GrowthLeadAdmissionState | null
} {
  const dmIntegrity = evaluateGrowthPipelinePromotionIntegrity({
    metadata: input.metadata,
    boundary: "decision_maker",
  })
  const packageIntegrity = evaluateGrowthPipelinePromotionIntegrity({
    metadata: input.metadata,
    boundary: "package",
  })
  return {
    needsReconcile: !dmIntegrity.ok || !packageIntegrity.ok,
    dmViolation: dmIntegrity.violation,
    packageViolation: packageIntegrity.violation,
    admissionState: dmIntegrity.admissionState,
  }
}

/**
 * Deterministic batch selection: downstream rows first (due pool order), integrity violations only,
 * capped at REVENUE_PROMOTION_RECONCILE_LIMIT_PER_ORG.
 */
export function planAdmissionDownstreamReconcileBatch(input: {
  dueStates: AdmissionDownstreamReconcileDueRow[]
  resolveMetadata: (leadId: string) => Record<string, unknown> | null | undefined
  limit?: number
}): AdmissionDownstreamReconcilePlan {
  const limit = Math.max(1, input.limit ?? REVENUE_PROMOTION_RECONCILE_LIMIT_PER_ORG)
  const ordered = [...input.dueStates].sort((a, b) => {
    const byUpdated = a.updatedAt.localeCompare(b.updatedAt)
    if (byUpdated !== 0) return byUpdated
    return a.leadId.localeCompare(b.leadId)
  })

  let downstreamFound = 0
  let integrityViolations = 0
  let skippedAlreadyCorrect = 0
  let skippedMissingMetadata = 0
  const violationRows: AdmissionDownstreamReconcileCandidate[] = []

  for (const row of ordered) {
    if (!isAdmissionDownstreamReconcileState(row.state)) continue
    downstreamFound += 1

    const metadata = input.resolveMetadata(row.leadId)
    if (metadata == null) {
      skippedMissingMetadata += 1
      continue
    }

    const need = evaluateAdmissionDownstreamReconcileNeed({ metadata })
    if (!need.needsReconcile) {
      skippedAlreadyCorrect += 1
      continue
    }

    integrityViolations += 1
    violationRows.push({
      ...row,
      admissionState: need.admissionState,
      dmViolation: need.dmViolation,
      packageViolation: need.packageViolation,
    })
  }

  const candidates = violationRows.slice(0, limit)
  const remainingAfterCap = Math.max(0, violationRows.length - candidates.length)

  return {
    qaMarker: GROWTH_REVENUE_2A_HOTFIX_1_QA_MARKER,
    limit,
    downstreamFound,
    integrityViolations,
    skippedAlreadyCorrect,
    skippedMissingMetadata,
    candidates,
    remainingAfterCap,
  }
}

export function isAdmissionReconcileCorrectedOutcome(input: {
  outcome: string
  nextState: string | null
}): boolean {
  if (input.outcome === "terminal_failure" || input.outcome === "stopped") return true
  if (input.nextState === "failed" || input.nextState === "paused") return true
  return false
}
