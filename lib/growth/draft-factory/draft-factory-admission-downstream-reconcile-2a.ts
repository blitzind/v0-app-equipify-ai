/**
 * GE-AIOS-REVENUE-2A-HOTFIX-1 — Admission downstream reconcile batch planner (client-safe).
 * GE-AIOS-REVENUE-2A-HOTFIX-2 — Wake-independent candidate scan for integrity violations.
 * Reuses integrity evaluator — no new scheduler, worker, or queue.
 */

import type { AiOsDraftFactoryDurableState } from "@/lib/growth/draft-factory/draft-factory-durable-types"
import {
  evaluateGrowthPipelinePromotionIntegrity,
  type GrowthPipelinePromotionIntegrityViolation,
} from "@/lib/growth/draft-factory/growth-pipeline-promotion-integrity-2a"
import {
  GROWTH_DRAFT_FACTORY_ADMISSION_RECONCILE_POOL_LIMIT,
  REVENUE_PROMOTION_RECONCILE_LIMIT_PER_ORG,
} from "@/lib/growth/draft-factory/draft-factory-wake-event-types"
import type { GrowthLeadAdmissionState } from "@/lib/growth/revenue-workflow/growth-lead-admission-types"

export const GROWTH_REVENUE_2A_HOTFIX_1_QA_MARKER =
  "ge-aios-revenue-2a-hotfix-1-admission-reconcile-v1" as const

export const GROWTH_REVENUE_2A_HOTFIX_2_QA_MARKER =
  "ge-aios-revenue-2a-hotfix-2-admission-reconcile-selection-v1" as const

export const GROWTH_REVENUE_2A_HOTFIX_3_QA_MARKER =
  "ge-aios-revenue-2a-hotfix-3-admission-reconcile-scheduler-order-v1" as const

/** Documented due-tick phase order after HOTFIX-3 (client-safe for certification). */
export const GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_PHASE_ORDER_HOTFIX_3 = [
  "load_due_pool",
  "load_reconcile_pool",
  "admission_reconcile",
  "datamoon_dm_poll",
  "classification",
  "enrichment",
  "portfolio_selection",
  "lead_advancement",
  "generation_capacity",
  "telemetry",
] as const

export { REVENUE_PROMOTION_RECONCILE_LIMIT_PER_ORG, GROWTH_DRAFT_FACTORY_ADMISSION_RECONCILE_POOL_LIMIT }

/** Nonterminal downstream states scanned for admission integrity reconcile (wake-independent). */
export const GROWTH_REVENUE_2A_ADMISSION_INTEGRITY_RECONCILE_SCAN_STATES = [
  "waiting_for_dm",
  "waiting_for_contact_verification",
  "waiting_for_personalization",
  "waiting_for_generation",
  "draft_ready",
  "waiting_for_approval",
] as const satisfies readonly AiOsDraftFactoryDurableState[]

/** @deprecated alias — use GROWTH_REVENUE_2A_ADMISSION_INTEGRITY_RECONCILE_SCAN_STATES */
export const GROWTH_REVENUE_2A_DOWNSTREAM_RECONCILE_STATES = new Set<
  AiOsDraftFactoryDurableState | string
>(GROWTH_REVENUE_2A_ADMISSION_INTEGRITY_RECONCILE_SCAN_STATES)

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
  if (input.outcome === "terminal_failure") return true
  if (input.nextState === "failed") return true
  return false
}
