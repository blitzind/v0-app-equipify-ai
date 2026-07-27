/** AVA-CONTINUOUS-LEAD-REPLENISHMENT-1A — Active candidate inventory for discovery replenishment (client-safe). */

import { evaluateGrowthPortfolioLeadEligibility } from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import type { GrowthLead } from "@/lib/growth/types"

export const GROWTH_AUTONOMOUS_CANDIDATE_INVENTORY_1A_QA_MARKER =
  "ava-continuous-lead-replenishment-1a-v1" as const

export type DraftFactoryInventoryState = {
  state: string
  pausedReason?: string | null
}

export type GrowthActiveCandidateInventorySnapshot = {
  qaMarker: typeof GROWTH_AUTONOMOUS_CANDIDATE_INVENTORY_1A_QA_MARKER
  activeCandidateCount: number
  totalEligibleCount: number
  excluded: {
    stopInvestment: number
    executedOrApprovedPipeline: number
    firstTouchComplete: number
    admissionRejected: number
    ineligible: number
  }
}

const NON_CANDIDATE_DRAFT_FACTORY_STATES = new Set([
  "executed",
  "waiting_for_approval",
  "approved",
])

function isStopInvestmentDraftFactoryState(state: DraftFactoryInventoryState | null | undefined): boolean {
  if (!state) return false
  return state.pausedReason === "stop_investment" || state.state === "paused" && state.pausedReason === "stop_investment"
}

export function isActiveCandidateLeadForReplenishment(input: {
  lead: GrowthLead
  organizationId: string
  draftFactoryState?: DraftFactoryInventoryState | null
  firstTouchComplete?: boolean
}): boolean {
  if (input.firstTouchComplete) return false

  const eligibility = evaluateGrowthPortfolioLeadEligibility({
    lead: input.lead,
    organizationId: input.organizationId,
  })
  if (!eligibility.eligible) return false

  const admission = resolveLeadAdmissionStateFromMetadata(input.lead.metadata)
  if (admission === "rejected" || admission === "invalid") return false

  const df = input.draftFactoryState
  if (isStopInvestmentDraftFactoryState(df)) return false
  if (df && NON_CANDIDATE_DRAFT_FACTORY_STATES.has(df.state)) return false

  return true
}

export function buildActiveCandidateInventorySnapshot(input: {
  organizationId: string
  leads: GrowthLead[]
  eligibleLeadCount: number
  draftFactoryStateByLeadId?: Map<string, DraftFactoryInventoryState>
  firstTouchCompleteLeadIds?: ReadonlySet<string>
}): GrowthActiveCandidateInventorySnapshot {
  const excluded = {
    stopInvestment: 0,
    executedOrApprovedPipeline: 0,
    firstTouchComplete: 0,
    admissionRejected: 0,
    ineligible: 0,
  }

  let activeCandidateCount = 0

  for (const lead of input.leads) {
    if (input.firstTouchCompleteLeadIds?.has(lead.id)) {
      excluded.firstTouchComplete += 1
      continue
    }

    const eligibility = evaluateGrowthPortfolioLeadEligibility({
      lead,
      organizationId: input.organizationId,
    })
    if (!eligibility.eligible) {
      excluded.ineligible += 1
      continue
    }

    const admission = resolveLeadAdmissionStateFromMetadata(lead.metadata)
    if (admission === "rejected" || admission === "invalid") {
      excluded.admissionRejected += 1
      continue
    }

    const df = input.draftFactoryStateByLeadId?.get(lead.id)
    if (isStopInvestmentDraftFactoryState(df)) {
      excluded.stopInvestment += 1
      continue
    }
    if (df && NON_CANDIDATE_DRAFT_FACTORY_STATES.has(df.state)) {
      excluded.executedOrApprovedPipeline += 1
      continue
    }

    activeCandidateCount += 1
  }

  return {
    qaMarker: GROWTH_AUTONOMOUS_CANDIDATE_INVENTORY_1A_QA_MARKER,
    activeCandidateCount,
    totalEligibleCount: input.eligibleLeadCount,
    excluded,
  }
}
