/** GE-AIOS-LIVE-1A — Production-only operator projections for Home / Operations (client-safe). */

import type { GrowthCanonicalDecisionResolution } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import type { GrowthCanonicalActiveMissionsProjection } from "@/lib/growth/aios/missions/growth-canonical-mission-1a-types"
import type {
  GrowthCanonicalOperatorApprovalSnapshot,
  GrowthCanonicalOperatorTask,
} from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-types"
import type { GrowthCanonicalOperatorFocus } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-focus-1a-types"
import {
  resolveCanonicalApprovalQueueCount,
  resolveCanonicalOutreachDraftCount,
} from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import type { GrowthAvaResearchLoopSummary } from "@/lib/growth/ava-home/growth-ava-research-orchestrator-types"
import { buildGrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import type { GrowthHomeLeadPoolSummary } from "@/lib/growth/home/growth-home-lead-pool-pagination"
import {
  buildLeadMissionPurposeIndex,
  filterLeadsForMissionPurposeScope,
  filterObjectivesForMissionPurposeScope,
  isProductionMissionPurpose,
  resolveLeadMissionPurpose,
  resolveObjectiveMissionPurpose,
  resolvePackageMissionPurpose,
} from "@/lib/growth/mission-purpose/growth-mission-purpose-1a"
import {
  GROWTH_MISSION_PURPOSE_1A_QA_MARKER,
  type GrowthMissionPurposeResolution,
  type GrowthMissionPurposeResolutionContext,
} from "@/lib/growth/mission-purpose/growth-mission-purpose-1a-types"
import {
  filterPortfolioEligibleLeads,
  sanitizeResearchLoopSummaryForPortfolio,
} from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"
import { GROWTH_PORTFOLIO_ELIGIBILITY_1A_QA_MARKER } from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a-types"
import type { GrowthPortfolioEligibilityContext } from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a-types"
import type { GrowthObjective } from "@/lib/growth/objectives/growth-objective-types"
import { buildRevenueQueueDashboardSectionsFromLeads } from "@/lib/growth/revenue-queue/revenue-queue-section-projection"
import type { GrowthLead } from "@/lib/growth/types"

export function filterProductionOperatorApprovalSnapshot(
  snapshot: GrowthCanonicalOperatorApprovalSnapshot | null,
  purposeByLeadId: ReadonlyMap<string, GrowthMissionPurposeResolution>,
): GrowthCanonicalOperatorApprovalSnapshot | null {
  if (!snapshot) return null

  const packages = snapshot.packages.filter((row) => {
    const leadPurpose = purposeByLeadId.get(row.leadId)?.purpose ?? "production"
    if (!isProductionMissionPurpose(leadPurpose)) return false
    return isProductionMissionPurpose(
      resolvePackageMissionPurpose({
        pkg: {
          leadId: row.leadId,
          companyName: row.companyName,
          expectedOutcome: null,
          complianceNotes: [],
        },
        leadPurpose,
      }).purpose,
    )
  })

  const topPackage =
    packages.find((row) => row.packageId === snapshot.topPackage?.packageId) ?? packages[0] ?? null

  return {
    ...snapshot,
    packages,
    topPackage,
    outreachPackageCount: packages.length,
    outreachDraftCount: packages.reduce((sum, row) => sum + Math.max(0, row.draftCount), 0),
    pendingApprovalCount: packages.length,
    waitingForOperator: packages.length > 0,
  }
}

export function filterProductionCanonicalOperatorFocus(input: {
  focus: GrowthCanonicalOperatorFocus | null
  purposeByLeadId: ReadonlyMap<string, GrowthMissionPurposeResolution>
}): GrowthCanonicalOperatorFocus | null {
  if (!input.focus) return null
  const purpose = input.purposeByLeadId.get(input.focus.leadId)?.purpose ?? "production"
  return isProductionMissionPurpose(purpose) ? input.focus : null
}

export function filterProductionCanonicalHeroDecision(input: {
  decision: GrowthCanonicalDecisionResolution | null
  purposeByLeadId: ReadonlyMap<string, GrowthMissionPurposeResolution>,
}): GrowthCanonicalDecisionResolution | null {
  if (!input.decision) return null
  const purpose = input.purposeByLeadId.get(input.decision.leadId)?.purpose ?? "production"
  return isProductionMissionPurpose(purpose) ? input.decision : null
}

export function filterProductionCanonicalOperatorTask(input: {
  task: GrowthCanonicalOperatorTask | null
  purposeByLeadId: ReadonlyMap<string, GrowthMissionPurposeResolution>
}): GrowthCanonicalOperatorTask | null {
  if (!input.task?.leadId) return input.task
  const purpose = purposeByLeadId.get(input.task.leadId)?.purpose ?? "production"
  return isProductionMissionPurpose(purpose) ? input.task : null
}

export function filterProductionActiveMissionsProjection(
  projection: GrowthCanonicalActiveMissionsProjection | null,
  purposeByLeadId: ReadonlyMap<string, GrowthMissionPurposeResolution>,
): GrowthCanonicalActiveMissionsProjection | null {
  if (!projection) return null
  const missions = projection.missions.filter((mission) =>
    isProductionMissionPurpose(purposeByLeadId.get(mission.leadId)?.purpose ?? "production"),
  )
  const displayLimit = projection.displayLimit
  const visibleMissions = missions.slice(0, displayLimit)
  return {
    ...projection,
    missions: visibleMissions,
    primaryMission: visibleMissions[0] ?? null,
    totalMissionCount: missions.length,
    overflowMissionCount: Math.max(0, missions.length - visibleMissions.length),
  }
}

export function buildProductionPortfolioEligibilityContext(
  organizationId: string,
  leads: GrowthLead[],
  purposeByLeadId: ReadonlyMap<string, GrowthMissionPurposeResolution>,
): GrowthPortfolioEligibilityContext {
  const productionLeads = filterLeadsForMissionPurposeScope(leads, purposeByLeadId, "operations")
  const portfolioEligible = filterPortfolioEligibleLeads(productionLeads, organizationId)
  return {
    qaMarker: GROWTH_PORTFOLIO_ELIGIBILITY_1A_QA_MARKER,
    organizationId,
    eligibleLeadIds: new Set(portfolioEligible.map((lead) => lead.id)),
    eligibleCount: portfolioEligible.length,
    excludedCount: Math.max(0, leads.length - portfolioEligible.length),
  }
}

export function buildProductionMissionPurposeProjection(input: {
  organizationId: string
  leads: GrowthLead[]
  objectives: GrowthObjective[]
  context: GrowthMissionPurposeResolutionContext
  approvalSnapshot?: GrowthCanonicalOperatorApprovalSnapshot | null
  researchLoopSummary?: GrowthAvaResearchLoopSummary | null
}) {
  const purposeByLeadId = buildLeadMissionPurposeIndex({
    leads: input.leads,
    context: input.context,
  })
  const productionLeads = filterLeadsForMissionPurposeScope(input.leads, purposeByLeadId, "operations")
  const productionObjectives = filterObjectivesForMissionPurposeScope(input.objectives, "operations")
  const productionApproval = filterProductionOperatorApprovalSnapshot(
    input.approvalSnapshot ?? null,
    purposeByLeadId,
  )
  const portfolioEligibility = buildProductionPortfolioEligibilityContext(
    input.organizationId,
    input.leads,
    purposeByLeadId,
  )
  const revenueQueueSections = buildRevenueQueueDashboardSectionsFromLeads(productionLeads, "priority")
  const sanitizedResearchLoop = sanitizeResearchLoopSummaryForPortfolio(
    input.researchLoopSummary ?? null,
    portfolioEligibility,
  )

  return {
    qaMarker: GROWTH_MISSION_PURPOSE_1A_QA_MARKER,
    purposeByLeadId,
    productionLeads,
    productionObjectives,
    productionApproval,
    portfolioEligibility,
    revenueQueueSections,
    sanitizedResearchLoop,
    productionApprovalCount: resolveCanonicalApprovalQueueCount(productionApproval, 0),
    productionDraftCount: resolveCanonicalOutreachDraftCount(productionApproval, 0),
  }
}

export function buildProductionMissionDiscoverySnapshot(input: {
  objectives: GrowthObjective[]
  leadPool?: GrowthHomeLeadPoolSummary | null
}): GrowthHomeMissionDiscoverySnapshot | null {
  const productionObjectives = filterObjectivesForMissionPurposeScope(input.objectives, "operations")
  return buildGrowthHomeMissionDiscoverySnapshot({
    objectives: productionObjectives,
    leadPool: input.leadPool,
  })
}

export function leadIsProductionOperation(input: {
  lead: Pick<GrowthLead, "id" | "companyName" | "createdAt" | "metadata">
  context: GrowthMissionPurposeResolutionContext
}): boolean {
  return isProductionMissionPurpose(resolveLeadMissionPurpose(input).purpose)
}

export function objectiveIsProductionOperation(objective: GrowthObjective): boolean {
  return isProductionMissionPurpose(resolveObjectiveMissionPurpose(objective).purpose)
}

export const GE_AIOS_LIVE_1A_OPERATOR_FILTER_QA_MARKER = GROWTH_MISSION_PURPOSE_1A_QA_MARKER
