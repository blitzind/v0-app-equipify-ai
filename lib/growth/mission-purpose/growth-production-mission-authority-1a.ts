/** GE-AIOS-LIVE-1A — Production mission authority (client-safe). */

import { LIVE_1B_EQUIPIFY_MISSION_TITLE } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import {
  GROWTH_MISSION_PURPOSE_1A_QA_MARKER,
  type GrowthProductionMissionAuthority,
} from "@/lib/growth/mission-purpose/growth-mission-purpose-1a-types"
import type { GrowthPortfolioManagerSnapshot } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"

const PRODUCTION_OBJECTIVE_STATEMENT =
  "Maintain a healthy portfolio of qualified companies by continuously discovering, researching, qualifying, and preparing outreach opportunities that match the approved Growth Profile." as const

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

export function buildProductionMissionAuthority(input: {
  portfolioManager?: GrowthPortfolioManagerSnapshot | null
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
  missionTitle?: string | null
}): GrowthProductionMissionAuthority {
  const portfolio = input.portfolioManager
  const discovery = input.missionDiscovery
  const portfolioBelowTarget = (portfolio?.health.needsCount ?? 0) > 0
  const discoveryActive =
    portfolio?.replenishment.shouldReplenish === true ||
    portfolio?.replenishment.shouldResumeActiveDiscovery === true ||
    portfolio?.operator.discoveryRunning === true ||
    discovery?.discoveryAction === "run_prospect_search" ||
    discovery?.discoveryAction === "refresh_audience"

  const newCompanies = discovery?.newCompaniesFound ?? 0
  const researchingCount = discovery?.counters.researchingCount ?? portfolio?.health.counts.researching ?? 0
  const packagesReady = portfolio?.health.counts.awaitingReview ?? 0
  const admissionsPending = portfolio?.health.counts.awaitingAdmission ?? discovery?.counters.pendingApprovals ?? 0
  const qualifiedCount = portfolio?.health.counts.qualified ?? 0

  const operatorSummaryLines: string[] = []
  if (newCompanies > 0) {
    operatorSummaryLines.push(
      `I found ${newCompanies} new ${pluralize(newCompanies, "company", "companies")} overnight.`,
    )
  }
  if (qualifiedCount > 0) {
    operatorSummaryLines.push(`${qualifiedCount} qualified for our ICP.`)
  }
  if (researchingCount > 0) {
    operatorSummaryLines.push(
      `${researchingCount} ${pluralize(researchingCount, "is", "are")} currently being researched.`,
    )
  }
  if (packagesReady > 0) {
    operatorSummaryLines.push(
      `${packagesReady} outreach ${pluralize(packagesReady, "package is", "packages are")} ready.`,
    )
  }
  if (portfolioBelowTarget) {
    operatorSummaryLines.push(
      "Portfolio is below target, so I'm actively discovering new opportunities.",
    )
  } else if (operatorSummaryLines.length === 0) {
    operatorSummaryLines.push("Portfolio is healthy. I'm maintaining discovery and research capacity.")
  }

  let primaryFocus: GrowthProductionMissionAuthority["primaryFocus"] = "maintain_capacity"
  if (portfolioBelowTarget || discoveryActive) primaryFocus = "discovery"
  else if (researchingCount > 0) primaryFocus = "research"
  else if (admissionsPending > 0) primaryFocus = "admission"
  else if (packagesReady > 0) primaryFocus = "approvals"
  else if ((portfolio?.health.counts.activeCompanies ?? 0) < (portfolio?.target.targetActiveCompanies ?? 0)) {
    primaryFocus = "portfolio_health"
  }

  return {
    qaMarker: GROWTH_MISSION_PURPOSE_1A_QA_MARKER,
    title: input.missionTitle?.trim() || LIVE_1B_EQUIPIFY_MISSION_TITLE,
    objectiveStatement: PRODUCTION_OBJECTIVE_STATEMENT,
    portfolioBelowTarget,
    discoveryActive,
    operatorSummaryLines,
    primaryFocus,
  }
}

export const GE_AIOS_LIVE_1A_PRODUCTION_MISSION_OBJECTIVE = PRODUCTION_OBJECTIVE_STATEMENT

export const GE_AIOS_LIVE_1A_PRODUCTION_MISSION_AUTHORITY_QA_MARKER = GROWTH_MISSION_PURPOSE_1A_QA_MARKER
