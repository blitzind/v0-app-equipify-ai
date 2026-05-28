/** Contact-first ranking — reachable humans before deep intelligence overlays. Client-safe. */

import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchIndexCompany,
} from "@/lib/growth/prospect-search/prospect-search-types"
import {
  resolveProspectSearchReachableHumanScore,
  type ProspectSearchReachableHumanSnapshot,
} from "@/lib/growth/prospect-search/prospect-search-reachable-human-scoring"

export const GROWTH_CONTACTABILITY_RANKING_QA_MARKER = "growth-contactability-ranking-v1" as const

const MAX_PRIMARY_CONTACTABILITY_BOOST = 0.35
const MAX_SECONDARY_INTELLIGENCE_BOOST = 0.12

export function computeProspectSearchIndexContactabilityBoost(
  row: GrowthProspectSearchIndexCompany,
): { boost: number; reasons: string[] } {
  const reasons: string[] = []
  let boost = 0
  const dm = row.decision_maker_count ?? 0

  if (dm >= 3) {
    boost += 0.18
    reasons.push(`${dm} indexed decision makers`)
  } else if (dm === 2) {
    boost += 0.14
    reasons.push("Multiple indexed decision makers")
  } else if (dm === 1) {
    boost += 0.08
    reasons.push("One indexed decision maker")
  }

  if (row.website?.trim()) {
    boost += 0.03
    reasons.push("Website available for contact acquisition")
  }

  if ((row.verification_status ?? "").toLowerCase().includes("verified")) {
    boost += 0.04
    reasons.push("Indexed verification signal")
  }

  return {
    boost: Math.min(MAX_PRIMARY_CONTACTABILITY_BOOST, boost),
    reasons,
  }
}

export function computeProspectSearchHydratedContactabilityBoost(
  company: GrowthProspectSearchCompanyResult,
  reachable?: ProspectSearchReachableHumanSnapshot,
): { boost: number; reasons: string[] } {
  const snapshot = reachable ?? resolveProspectSearchReachableHumanScore(company)
  let boost = snapshot.score / 100 * MAX_PRIMARY_CONTACTABILITY_BOOST
  const reasons = [...snapshot.reasons.slice(0, 3)]

  if (snapshot.label === "outreach_ready") {
    boost += 0.08
    reasons.push("Outreach-ready reachable human")
  } else if (snapshot.label === "no_reachable_humans") {
    boost = Math.min(boost, 0.02)
    reasons.push("No reachable humans — deprioritized vs contactable accounts")
  }

  return {
    boost: Math.min(MAX_PRIMARY_CONTACTABILITY_BOOST + 0.08, boost),
    reasons,
  }
}

export function computeProspectSearchSecondaryIntelligenceBoost(
  company: GrowthProspectSearchCompanyResult,
): number {
  let boost = 0
  if ((company.intent_score ?? 0) >= 15) boost += 0.02
  if ((company.lead_engine_score ?? company.lead_score ?? 0) >= 70) boost += 0.03
  if (company.company_signal_summary?.technology_signals?.length) boost += 0.02
  if ((company.growth_signal_score ?? 0) >= 60) boost += 0.02
  if (company.committee_completion?.completion_score) boost += 0.02
  return Math.min(MAX_SECONDARY_INTELLIGENCE_BOOST, boost)
}

export function rankProspectSearchCompaniesByContactability(
  companies: GrowthProspectSearchCompanyResult[],
): GrowthProspectSearchCompanyResult[] {
  return [...companies]
    .map((company) => {
      const reachable = resolveProspectSearchReachableHumanScore(company)
      const { boost, reasons } = computeProspectSearchHydratedContactabilityBoost(company, reachable)
      const secondary = computeProspectSearchSecondaryIntelligenceBoost(company)
      const contact_first_rank_score = Number((boost + secondary * 0.35 + company.rank_score * 0.25).toFixed(4))
      return {
        ...company,
        reachable_human: reachable,
        contactability_status: reachable.label,
        contact_first_rank_score,
        match_reasoning: [
          ...reasons.slice(0, 2),
          ...company.match_reasoning.slice(0, 2),
        ],
      }
    })
    .sort((a, b) => (b.contact_first_rank_score ?? 0) - (a.contact_first_rank_score ?? 0))
}

export function attachReachableHumanToCompanies(
  companies: GrowthProspectSearchCompanyResult[],
): GrowthProspectSearchCompanyResult[] {
  return companies.map((company) => {
    const reachable = resolveProspectSearchReachableHumanScore(company)
    return {
      ...company,
      reachable_human: reachable,
      contactability_status: reachable.label,
      lightweight_mode: reachable.label === "no_reachable_humans" || reachable.label === "generic_channel_only",
    }
  })
}
