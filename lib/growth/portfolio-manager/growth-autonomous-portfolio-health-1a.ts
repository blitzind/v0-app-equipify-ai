/** GE-AIOS-AUTONOMOUS-PORTFOLIO-MANAGER-1A — Portfolio health read model (client-safe). */

import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import { evaluateGrowthPortfolioLeadEligibility } from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"
import {
  GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
  type GrowthPortfolioHealthCounts,
  type GrowthPortfolioHealthReadModel,
  type GrowthPortfolioHealthState,
  type GrowthPortfolioTargetProjection,
} from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import type { GrowthLead } from "@/lib/growth/types"

function emptyCounts(): GrowthPortfolioHealthCounts {
  return {
    activeCompanies: 0,
    researching: 0,
    awaitingAdmission: 0,
    awaitingReview: 0,
    qualified: 0,
    archived: 0,
    rejected: 0,
    invalid: 0,
    discoveryRemaining: 0,
  }
}

function resolveHealthState(input: {
  activeCompanies: number
  minimumHealthyCompanies: number
  approvedProfilePresent: boolean
}): GrowthPortfolioHealthState {
  if (!input.approvedProfilePresent) return "operator_intervention_required"
  if (input.activeCompanies >= input.minimumHealthyCompanies) return "healthy"
  const criticalThreshold = Math.max(1, Math.floor(input.minimumHealthyCompanies * 0.25))
  if (input.activeCompanies <= criticalThreshold) return "critically_low"
  return "needs_replenishment"
}

export function buildPortfolioHealthCountsFromLeads(input: {
  organizationId: string
  leads: GrowthLead[]
  eligibleLeadCount: number
  researchingCount?: number
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
}): GrowthPortfolioHealthCounts {
  const counts = emptyCounts()
  counts.activeCompanies = input.eligibleLeadCount

  for (const lead of input.leads) {
    const status = lead.status?.trim().toLowerCase() ?? ""
    if (status === "archived") {
      counts.archived += 1
      continue
    }
    if (status === "disqualified") {
      counts.rejected += 1
      continue
    }

    const admission = resolveLeadAdmissionStateFromMetadata(lead.metadata)
    if (admission === "review") {
      counts.awaitingReview += 1
      counts.awaitingAdmission += 1
      continue
    }
    if (admission === "rejected") {
      counts.rejected += 1
      continue
    }
    if (admission === "invalid") {
      counts.invalid += 1
      continue
    }
    if (admission == null) {
      counts.awaitingAdmission += 1
      continue
    }

    const eligibility = evaluateGrowthPortfolioLeadEligibility({
      lead,
      organizationId: input.organizationId,
    })
    if (!eligibility.eligible) continue

    if (status === "qualified") {
      counts.qualified += 1
    }
  }

  counts.researching =
    input.researchingCount ??
    input.missionDiscovery?.counters.researchingCount ??
    0

  const target = input.missionDiscovery?.leadPoolVisible ?? counts.activeCompanies
  counts.discoveryRemaining = Math.max(0, target - counts.activeCompanies)

  return counts
}

export function buildPortfolioHealthReadModel(input: {
  organizationId: string
  target: GrowthPortfolioTargetProjection
  leads: GrowthLead[]
  eligibleLeadCount: number
  approvedProfilePresent: boolean
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
  researchingCount?: number
}): GrowthPortfolioHealthReadModel {
  const counts = buildPortfolioHealthCountsFromLeads({
    organizationId: input.organizationId,
    leads: input.leads,
    eligibleLeadCount: input.eligibleLeadCount,
    researchingCount: input.researchingCount,
    missionDiscovery: input.missionDiscovery,
  })

  const healthState = resolveHealthState({
    activeCompanies: counts.activeCompanies,
    minimumHealthyCompanies: input.target.minimumHealthyCompanies,
    approvedProfilePresent: input.approvedProfilePresent,
  })

  const discoveryRunning =
    input.missionDiscovery?.lifecycleState === "finding_leads" ||
    input.missionDiscovery?.discoveryAction === "run_prospect_search" ||
    input.missionDiscovery?.discoveryAction === "refresh_audience"

  const researchRunning =
    counts.researching > 0 ||
    input.missionDiscovery?.lifecycleState === "researching" ||
    input.missionDiscovery?.discoveryAction === "begin_research"

  return {
    qaMarker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
    healthState,
    counts,
    needsCount: Math.max(0, input.target.targetActiveCompanies - counts.activeCompanies),
    approvedProfilePresent: input.approvedProfilePresent,
    discoveryRunning,
    researchRunning,
    admissionsPending: counts.awaitingAdmission + counts.awaitingReview,
  }
}

export function shouldPortfolioManagerTriggerDiscovery(
  health: GrowthPortfolioHealthReadModel,
): boolean {
  return (
    health.approvedProfilePresent &&
    (health.healthState === "needs_replenishment" || health.healthState === "critically_low")
  )
}
