/** GE-AIOS-AUTONOMOUS-PORTFOLIO-MANAGER-1A — Canonical portfolio manager snapshot builder (client-safe). */

import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import type { AvaOrganizationalMemoryStore } from "@/lib/growth/memory/types"
import type { OrganizationalKnowledgeItem } from "@/lib/growth/memory/knowledge/organization-knowledge-types"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import {
  buildMarketIntelligenceOperatorProjection,
  evaluateMarketIntelligenceLoop,
} from "@/lib/growth/market-intelligence/growth-market-intelligence-loop-1a"
import { parseMarketIntelligenceLoopMemoryFromStore } from "@/lib/growth/market-intelligence/growth-market-intelligence-memory-1a"
import type { SalesOutcome } from "@/lib/growth/specialists/execution/sales-outcome-types"
import type { GrowthLead } from "@/lib/growth/types"
import { buildPortfolioHealthReadModel } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-health-1a"
import {
  emptyPortfolioManagerMemory,
  parsePortfolioManagerMemoryFromStore,
} from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-memory-1a"
import { buildPortfolioManagerOperatorProjection } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-operator-projection-1a"
import { evaluatePortfolioReplenishmentDecision } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-replenishment-1a"
import { resolvePortfolioTargetFromBusinessProfile } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-target-1a"
import {
  GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
  type GrowthPortfolioManagerSnapshot,
} from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"

export function buildGrowthPortfolioManagerSnapshot(input: {
  organizationId: string
  generatedAt: string
  leads: GrowthLead[]
  eligibleLeadCount: number
  approvedProfile: Pick<BusinessProfileDraftContent, "portfolioManagement"> | BusinessProfileDraftContent | null
  organizationalMemory?: AvaOrganizationalMemoryStore | null
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
  researchingCount?: number
  validatedLearnings?: OrganizationalKnowledgeItem[]
  salesOutcomes?: SalesOutcome[]
}): GrowthPortfolioManagerSnapshot {
  const target = resolvePortfolioTargetFromBusinessProfile(input.approvedProfile)
  const memory = input.organizationalMemory
    ? parsePortfolioManagerMemoryFromStore(input.organizationalMemory)
    : emptyPortfolioManagerMemory()

  const health = buildPortfolioHealthReadModel({
    organizationId: input.organizationId,
    target,
    leads: input.leads,
    eligibleLeadCount: input.eligibleLeadCount,
    approvedProfilePresent: Boolean(input.approvedProfile),
    missionDiscovery: input.missionDiscovery,
    researchingCount: input.researchingCount,
  })

  const replenishment = evaluatePortfolioReplenishmentDecision({
    target,
    health,
    memory,
    generatedAt: input.generatedAt,
    discoveryAlreadyRunning: health.discoveryRunning,
  })

  const operator = buildPortfolioManagerOperatorProjection({
    target,
    health,
    replenishment,
    generatedAt: input.generatedAt,
  })

  const fullApprovedProfile =
    input.approvedProfile && "company" in input.approvedProfile
      ? (input.approvedProfile as BusinessProfileDraftContent)
      : null
  const loopMemory = parseMarketIntelligenceLoopMemoryFromStore(input.organizationalMemory ?? null)
  const marketEvaluation = evaluateMarketIntelligenceLoop({
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    approvedProfile: fullApprovedProfile,
    validatedLearnings: input.validatedLearnings ?? [],
    leads: input.leads,
    salesOutcomes: input.salesOutcomes ?? [],
    organizationalMemory: input.organizationalMemory ?? null,
    loopMemory,
  })
  const marketIntelligence = buildMarketIntelligenceOperatorProjection({
    approvedProfile: fullApprovedProfile,
    evaluation: marketEvaluation,
    loopMemory,
  })

  return {
    qaMarker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
    target,
    health,
    memory,
    replenishment,
    operator,
    marketIntelligence,
  }
}

export { GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER }
