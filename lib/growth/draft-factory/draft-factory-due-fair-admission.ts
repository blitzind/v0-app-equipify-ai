/**
 * GE-AIOS-AUTONOMY-1E — Fair capacity-class admission (client-safe).
 *
 * Discovers capacity classes from the full due pool before expensive SV1-1 work.
 * Samples a bounded FIFO set per class so one backlog cannot consume enrichment budget.
 */

import {
  allocateDueSlotsByCapacityClass,
  mapDurableStateToPortfolioCapacityClass,
} from "@/lib/growth/draft-factory/draft-factory-due-capacity-class"
import type { AiOsDraftFactoryDurableState } from "@/lib/growth/draft-factory/draft-factory-durable-types"
import { GROWTH_DRAFT_FACTORY_DUE_CLASS_CANDIDATE_CAP } from "@/lib/growth/draft-factory/draft-factory-wake-event-types"
import type { AiOsPortfolioCapacityClass } from "@/lib/growth/portfolio-allocation/portfolio-allocation-types"

export const GROWTH_AIOS_AUTONOMY_1E_QA_MARKER =
  "ge-aios-autonomy-1e-fair-capacity-class-admission-v1" as const

/**
 * Per-class SV1-1 sample size:
 *   max(slots × COMPARISON_MULTIPLIER, MIN_CLASS_SAMPLE), capped by perClassCandidateCap.
 * Multiplier gives SV1-2 enough peers to rank/displace without enriching the whole backlog.
 */
export const GROWTH_DRAFT_FACTORY_DUE_CLASS_SAMPLE_COMPARISON_MULTIPLIER = 3 as const
export const GROWTH_DRAFT_FACTORY_DUE_CLASS_MIN_SAMPLE = 2 as const

export type DueStateClassifiedCandidate = {
  leadId: string
  state: AiOsDraftFactoryDurableState | string
  updatedAt: string
  capacityClass: AiOsPortfolioCapacityClass
}

export type DueClassAdmissionPlan = {
  qa_marker: typeof GROWTH_AIOS_AUTONOMY_1E_QA_MARKER
  duePoolCount: number
  skippedUnmappedState: number
  activeCapacityClasses: AiOsPortfolioCapacityClass[]
  rawCountByClass: Record<string, number>
  slotCountByClass: Record<string, number>
  candidateCapByClass: Record<string, number>
  sampledCountByClass: Record<string, number>
  /** Deterministic union for SV1-1 enrichment (class ASC, then updated_at ASC, then leadId). */
  sampledCandidates: DueStateClassifiedCandidate[]
}

export function computeDueClassEnrichmentSampleSize(input: {
  slotsAllocated: number
  perClassCandidateCap?: number
}): number {
  const cap = Math.max(1, input.perClassCandidateCap ?? GROWTH_DRAFT_FACTORY_DUE_CLASS_CANDIDATE_CAP)
  const slots = Math.max(0, Math.floor(input.slotsAllocated))
  const target = Math.max(
    GROWTH_DRAFT_FACTORY_DUE_CLASS_MIN_SAMPLE,
    slots * GROWTH_DRAFT_FACTORY_DUE_CLASS_SAMPLE_COMPARISON_MULTIPLIER,
  )
  return Math.min(cap, target)
}

/**
 * Pure classification of the full due pool — no lead fetch / SV1-1 / network.
 * Preserves FIFO (updated_at ASC, leadId) within each class when sampling.
 */
export function planFairDueCapacityClassAdmission(input: {
  dueStates: Array<{
    leadId: string
    state: AiOsDraftFactoryDurableState | string
    updatedAt: string
  }>
  totalAdvanceBudget: number
  perClassCandidateCap?: number
}): DueClassAdmissionPlan {
  const perClassCandidateCap = Math.max(
    1,
    input.perClassCandidateCap ?? GROWTH_DRAFT_FACTORY_DUE_CLASS_CANDIDATE_CAP,
  )

  const byClass = new Map<AiOsPortfolioCapacityClass, DueStateClassifiedCandidate[]>()
  let skippedUnmappedState = 0

  for (const row of input.dueStates) {
    const capacityClass = mapDurableStateToPortfolioCapacityClass(row.state)
    if (!capacityClass) {
      skippedUnmappedState += 1
      continue
    }
    const bucket = byClass.get(capacityClass) ?? []
    bucket.push({
      leadId: row.leadId,
      state: row.state,
      updatedAt: row.updatedAt,
      capacityClass,
    })
    byClass.set(capacityClass, bucket)
  }

  for (const [capacityClass, rows] of byClass) {
    rows.sort((a, b) => {
      const byUpdated = a.updatedAt.localeCompare(b.updatedAt)
      if (byUpdated !== 0) return byUpdated
      return a.leadId.localeCompare(b.leadId)
    })
    byClass.set(capacityClass, rows)
  }

  const activeCapacityClasses = [...byClass.keys()].sort((a, b) => a.localeCompare(b))
  const slotPlan = allocateDueSlotsByCapacityClass({
    capacityClasses: activeCapacityClasses,
    totalBudget: input.totalAdvanceBudget,
  })

  const rawCountByClass: Record<string, number> = {}
  const slotCountByClass: Record<string, number> = {}
  const candidateCapByClass: Record<string, number> = {}
  const sampledCountByClass: Record<string, number> = {}
  const sampledCandidates: DueStateClassifiedCandidate[] = []

  for (const capacityClass of activeCapacityClasses) {
    const rows = byClass.get(capacityClass) ?? []
    const slotsAllocated = slotPlan.get(capacityClass) ?? 0
    const sampleSize = computeDueClassEnrichmentSampleSize({
      slotsAllocated,
      perClassCandidateCap,
    })
    const sampled = rows.slice(0, sampleSize)
    rawCountByClass[capacityClass] = rows.length
    slotCountByClass[capacityClass] = slotsAllocated
    candidateCapByClass[capacityClass] = sampleSize
    sampledCountByClass[capacityClass] = sampled.length
    sampledCandidates.push(...sampled)
  }

  // Deterministic enrichment order across classes (not FIFO across the whole pool).
  sampledCandidates.sort((a, b) => {
    const byClassOrder = a.capacityClass.localeCompare(b.capacityClass)
    if (byClassOrder !== 0) return byClassOrder
    const byUpdated = a.updatedAt.localeCompare(b.updatedAt)
    if (byUpdated !== 0) return byUpdated
    return a.leadId.localeCompare(b.leadId)
  })

  return {
    qa_marker: GROWTH_AIOS_AUTONOMY_1E_QA_MARKER,
    duePoolCount: input.dueStates.length,
    skippedUnmappedState,
    activeCapacityClasses,
    rawCountByClass,
    slotCountByClass,
    candidateCapByClass,
    sampledCountByClass,
    sampledCandidates,
  }
}
