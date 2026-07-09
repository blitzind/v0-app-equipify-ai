/** GE-AIOS-18G — Autonomous lead discovery narrative + decision copy (client-safe). */

import type {
  AutonomousLeadDiscoveryAction,
  GrowthHomeMissionDiscoverySnapshot,
} from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"

export const GROWTH_AUTONOMOUS_LEAD_DISCOVERY_18G_QA_MARKER =
  "ge-aios-18g-autonomous-lead-discovery-v1" as const

function discoveryTarget(snapshot: GrowthHomeMissionDiscoverySnapshot): string | null {
  return snapshot.audienceName?.trim() || snapshot.searchSummary?.trim() || null
}

export function buildLeadDiscoveryWorkingNowLine(
  snapshot: GrowthHomeMissionDiscoverySnapshot | null | undefined,
): string | null {
  if (!snapshot?.startupDiscoveryReady) return null
  const target = discoveryTarget(snapshot)

  if (snapshot.lifecycleState === "finding_leads") {
    if (snapshot.newCompaniesFound > 0 && target) {
      return `I'm finding ${snapshot.newCompaniesFound} more companies matching ${target}.`
    }
    if (snapshot.pipelineLow && target) {
      return `I'm researching another batch of ${target} because we've nearly exhausted our current pipeline.`
    }
    if (target) {
      return `I'm searching for companies matching ${target}.`
    }
    return "I'm running lead discovery for today's mission."
  }

  if (snapshot.lifecycleState === "researching" && snapshot.counters.researchingCount > 0) {
    return `I'm researching ${snapshot.counters.researchingCount} ${snapshot.counters.researchingCount === 1 ? "company" : "companies"} from the latest discovery run.`
  }

  if (snapshot.discoveryAction === "refresh_audience" && target) {
    return `I'm refreshing our ${target} audience to find more companies to research.`
  }

  if (snapshot.discoveryAction === "run_prospect_search" && target) {
    return `I'm preparing to search for ${target} — we need more companies in the pipeline.`
  }

  if (snapshot.lastEventSummary && /found|import|refresh|search/i.test(snapshot.lastEventSummary)) {
    return snapshot.lastEventSummary.endsWith(".")
      ? snapshot.lastEventSummary
      : `${snapshot.lastEventSummary}.`
  }

  return null
}

export function buildLeadDiscoveryWorkingNextLine(
  snapshot: GrowthHomeMissionDiscoverySnapshot | null | undefined,
): string | null {
  if (!snapshot?.startupDiscoveryReady) return null

  switch (snapshot.discoveryAction) {
    case "run_prospect_search": {
      const target = discoveryTarget(snapshot)
      return target
        ? `Next I'll run our Find Leads search for ${target} and import matching companies.`
        : "Next I'll run our Find Leads search and import matching companies."
    }
    case "refresh_audience": {
      const target = discoveryTarget(snapshot)
      return target
        ? `Next I'll refresh the ${target} audience and import any new companies.`
        : "Next I'll refresh our audience and import any new companies."
    }
    case "begin_research":
      return "Next I'll continue researching the companies we discovered."
    case "prepare_outreach":
      return "Next I'll prepare outreach once you approve the drafts waiting for review."
    case "follow_up":
      return "Next I'll follow up on active conversations."
    case "monitoring":
      return "Next I'll keep monitoring our audience for new companies that match your profile."
    default:
      return null
  }
}

export function buildLeadDiscoveryCompletedLine(
  snapshot: GrowthHomeMissionDiscoverySnapshot | null | undefined,
): string | null {
  if (!snapshot) return null
  if (snapshot.recordsImported > 0 && snapshot.newCompaniesFound > 0) {
    return `I imported ${snapshot.recordsImported} ${snapshot.recordsImported === 1 ? "company" : "companies"} from our latest discovery run.`
  }
  if (snapshot.recordsImported > 0) {
    return `I imported ${snapshot.recordsImported} ${snapshot.recordsImported === 1 ? "company" : "companies"} into today's queue.`
  }
  return null
}

export function resolveLeadDiscoveryNarrativeFocus(
  snapshot: GrowthHomeMissionDiscoverySnapshot | null | undefined,
): "discovery" | null {
  if (!snapshot?.startupDiscoveryReady) return null
  if (
    snapshot.lifecycleState === "finding_leads" ||
    snapshot.discoveryAction === "run_prospect_search" ||
    snapshot.discoveryAction === "refresh_audience"
  ) {
    return "discovery"
  }
  return null
}

export function discoveryActionLabel(action: AutonomousLeadDiscoveryAction): string {
  switch (action) {
    case "run_prospect_search":
      return "Run Prospect Search"
    case "refresh_audience":
      return "Refresh audience"
    case "begin_research":
      return "Begin research"
    case "prepare_outreach":
      return "Prepare outreach"
    case "follow_up":
      return "Follow up"
    case "monitoring":
      return "Monitor audience"
    default:
      return "Idle"
  }
}
