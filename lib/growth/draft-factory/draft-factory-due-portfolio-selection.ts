/**
 * GE-AIOS-AUTONOMY-1C — Portfolio-aware due-state selection (client-safe).
 *
 * Reuses SV1-1 investment projection + SV1-2 portfolio allocation.
 * FIFO (`updatedAt ASC`) is only the final tie-break via priorityBindingRank.
 * Does not register a scheduler and does not invent ranking dimensions.
 */

import {
  allocateDueSlotsByCapacityClass,
  GROWTH_AIOS_AUTONOMY_1C_QA_MARKER,
  mapDurableStateToPortfolioCapacityClass,
} from "@/lib/growth/draft-factory/draft-factory-due-capacity-class"
import type { AiOsDraftFactoryDurableState } from "@/lib/growth/draft-factory/draft-factory-durable-types"
import { evaluatePortfolioAllocationFacade } from "@/lib/growth/portfolio-allocation/portfolio-allocation-facade-engine"
import type {
  AiOsPortfolioCandidate,
  AiOsPortfolioCapacityClass,
} from "@/lib/growth/portfolio-allocation/portfolio-allocation-types"
import type { AiOsInvestmentState } from "@/lib/growth/resource-allocation/resource-allocation-types"

export type DuePortfolioSelectionCandidate = {
  leadId: string
  state: AiOsDraftFactoryDurableState | string
  updatedAt: string
  investmentState: AiOsInvestmentState | null
  spendAuthorized?: boolean | null
  companyName?: string | null
  researchFresh?: boolean | null
  researchStale?: boolean | null
}

export type DuePortfolioSelectionInput = {
  organizationId: string
  dueStates: DuePortfolioSelectionCandidate[]
  totalAdvanceBudget: number
  /** Max FIFO candidates considered per capacity class before portfolio ranks. */
  perClassCandidateCap?: number
  decidedAt?: string
}

export type DuePortfolioClassSelection = {
  capacityClass: AiOsPortfolioCapacityClass
  slotsAllocated: number
  candidateCount: number
  eligibleCount: number
  selectedLeadIds: string[]
  deferredLeadIds: string[]
  skippedStopInvestment: number
}

export type DuePortfolioSelectionResult = {
  qa_marker: typeof GROWTH_AIOS_AUTONOMY_1C_QA_MARKER
  selectedLeadIds: string[]
  /** Lead → capacity class for explainability / wake metadata. */
  selectedByClass: Record<string, AiOsPortfolioCapacityClass>
  classSelections: DuePortfolioClassSelection[]
  skippedUnmappedState: number
  totalDueConsidered: number
}

function fifoTieBreakRank(updatedAt: string, indexAmongFifo: number): number {
  // Lower binding rank wins on score ties in SV1-2 compareCandidates.
  // Offset above the SV1-2 binding-rank score-boost window (ranks 1–5) so FIFO
  // is only a tie-break — it must not change composePortfolioPriorityScore.
  void updatedAt
  return 100 + indexAmongFifo
}

/**
 * Select due Draft Factory leads by capacity-class buckets + SV1-1/SV1-2.
 * Ordering authority: investment eligibility → portfolio selection → FIFO tie-break.
 */
export function selectPortfolioAwareDueDraftFactoryStates(
  input: DuePortfolioSelectionInput,
): DuePortfolioSelectionResult {
  const perClassCandidateCap = Math.max(1, input.perClassCandidateCap ?? 20)
  const decidedAt = input.decidedAt ?? new Date().toISOString()

  const byClass = new Map<AiOsPortfolioCapacityClass, DuePortfolioSelectionCandidate[]>()
  let skippedUnmappedState = 0

  for (const row of input.dueStates) {
    const capacityClass = mapDurableStateToPortfolioCapacityClass(row.state)
    if (!capacityClass) {
      skippedUnmappedState += 1
      continue
    }
    const bucket = byClass.get(capacityClass) ?? []
    bucket.push(row)
    byClass.set(capacityClass, bucket)
  }

  for (const [capacityClass, rows] of byClass) {
    rows.sort((a, b) => {
      const byUpdated = a.updatedAt.localeCompare(b.updatedAt)
      if (byUpdated !== 0) return byUpdated
      return a.leadId.localeCompare(b.leadId)
    })
    byClass.set(capacityClass, rows.slice(0, perClassCandidateCap))
  }

  const activeClasses = [...byClass.keys()].sort((a, b) => a.localeCompare(b))
  const slotPlan = allocateDueSlotsByCapacityClass({
    capacityClasses: activeClasses,
    totalBudget: input.totalAdvanceBudget,
  })

  const selectedLeadIds: string[] = []
  const selectedByClass: Record<string, AiOsPortfolioCapacityClass> = {}
  const classSelections: DuePortfolioClassSelection[] = []
  const seenSelected = new Set<string>()

  for (const capacityClass of activeClasses) {
    const slotsAllocated = slotPlan.get(capacityClass) ?? 0
    const pool = byClass.get(capacityClass) ?? []

    let skippedStopInvestment = 0
    const portfolioCandidates: AiOsPortfolioCandidate[] = []

    pool.forEach((row, index) => {
      if (row.investmentState === "stop_investment") {
        skippedStopInvestment += 1
        return
      }
      portfolioCandidates.push({
        leadId: row.leadId,
        organizationId: input.organizationId,
        companyName: row.companyName ?? null,
        investmentState: row.investmentState,
        spendAuthorized: row.spendAuthorized ?? row.investmentState === "increase_investment",
        signals: {
          missionAligned: true,
          // Equal mission scores → FIFO via binding rank (older = lower rank = wins).
          missionPriorityOverall: 50,
          priorityBindingRank: fifoTieBreakRank(row.updatedAt, index),
          researchFresh: row.researchFresh ?? null,
          researchStale: row.researchStale ?? null,
        },
      })
    })

    const portfolio = evaluatePortfolioAllocationFacade({
      organizationId: input.organizationId,
      capacityClass,
      capacitySlotsAvailable: slotsAllocated,
      candidates: portfolioCandidates,
      mode: "enforce",
      decidedAt,
    })

    const selectedForClass: string[] = []
    for (const leadId of portfolio.selectedLeadIds) {
      if (seenSelected.has(leadId)) continue
      if (selectedLeadIds.length >= input.totalAdvanceBudget) break
      seenSelected.add(leadId)
      selectedLeadIds.push(leadId)
      selectedForClass.push(leadId)
      selectedByClass[leadId] = capacityClass
    }

    classSelections.push({
      capacityClass,
      slotsAllocated,
      candidateCount: pool.length,
      eligibleCount: portfolioCandidates.length,
      selectedLeadIds: selectedForClass,
      deferredLeadIds: portfolio.deferredLeadIds.filter((id) => !seenSelected.has(id)),
      skippedStopInvestment,
    })
  }

  return {
    qa_marker: GROWTH_AIOS_AUTONOMY_1C_QA_MARKER,
    selectedLeadIds,
    selectedByClass,
    classSelections,
    skippedUnmappedState,
    totalDueConsidered: input.dueStates.length,
  }
}
