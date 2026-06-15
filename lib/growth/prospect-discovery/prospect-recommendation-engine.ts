/** Phase GS-2D — Signal-aware prospect recommendation engine (client-safe). */

import {
  buildProspectPriorityScore,
  buildProspectPriorityScoreInputFromCompany,
  detectCompetitorSignalStrength,
  detectFundingSignalStrength,
  detectHiringSignalStrength,
  detectWebsiteIntentStrength,
} from "@/lib/growth/prospect-discovery/prospect-priority-scoring"
import {
  PROSPECT_RECOMMENDATION_QA_MARKER,
  PROSPECT_RECOMMENDATION_TYPE_LABELS,
  type ProspectEstimatedRevenueImpact,
  type ProspectRecommendation,
  type ProspectRecommendationType,
} from "@/lib/growth/prospect-discovery/prospect-recommendation-types"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

export type GenerateProspectRecommendationsInput = {
  execution_run_id: string
  companies: GrowthProspectSearchCompanyResult[]
  qualified_company_ids?: string[]
  search_industry_hint?: string | null
}

function estimateRevenueImpact(
  company: GrowthProspectSearchCompanyResult,
  priorityScore: number,
): ProspectEstimatedRevenueImpact {
  const base = priorityScore
  const tierBoost =
    (company.growth_signal_tier ?? "") === "hot"
      ? 15
      : (company.growth_signal_tier ?? "") === "warm"
        ? 8
        : 0
  const sort_score = Math.min(100, Math.round(base + tierBoost))

  let level: ProspectEstimatedRevenueImpact["level"] = "low"
  if (sort_score >= 85) level = "very_high"
  else if (sort_score >= 70) level = "high"
  else if (sort_score >= 50) level = "moderate"

  const summary =
    level === "very_high"
      ? "Very High"
      : level === "high"
        ? "High"
        : level === "moderate"
          ? "Moderate"
          : "Low"

  return { level, summary, sort_score }
}

function recommendationTypesForCompany(
  company: GrowthProspectSearchCompanyResult,
  searchIndustryHint?: string | null,
): ProspectRecommendationType[] {
  const signals = company.signals ?? []
  const types = new Set<ProspectRecommendationType>(["review_company"])

  if ((company.growth_signal_score ?? 0) < 60 || !company.company_signal_summary) {
    types.add("run_company_intelligence")
  }

  if ((company.decision_maker_coverage ?? 0) < 65 || (company.committee_completion?.completion_pct ?? 100) < 70) {
    types.add("run_buying_committee_expansion")
  }

  if (signals.length > 0 || (company.signal_count ?? 0) > 0) {
    types.add("review_signal_activity")
  }

  if (detectHiringSignalStrength(signals, company) >= 50 || detectFundingSignalStrength(signals, company) >= 50) {
    types.add("enroll_sequence")
    types.add("schedule_call")
  }

  if (detectWebsiteIntentStrength(signals, company) >= 50) {
    types.add("schedule_call")
    types.add("enroll_sequence")
  }

  if (detectCompetitorSignalStrength(signals) >= 50) {
    types.add("research_competitor")
  }

  if ((company.lead_engine_score ?? company.lead_score ?? 0) >= 70) {
    types.add("enroll_sequence")
  }

  const industry = `${company.industry ?? ""} ${searchIndustryHint ?? ""}`.toLowerCase()
  if (/biomed|hvac|field service/.test(industry) && (company.rank_score ?? 0) >= 55) {
    types.add("run_company_intelligence")
  }

  return [...types]
}

function reasoningForType(
  type: ProspectRecommendationType,
  company: GrowthProspectSearchCompanyResult,
  factors: string[],
): string[] {
  const label = PROSPECT_RECOMMENDATION_TYPE_LABELS[type]
  const base = [`${label} recommended for ${company.company_name}.`]
  if (factors.length > 0) base.push(`Key factors: ${factors.join(", ")}.`)
  if (type === "enroll_sequence") {
    base.push("Sequence recommendation only — human approval required before enrollment.")
  }
  return base
}

function recommendedActionsForTypes(types: ProspectRecommendationType[]): string[] {
  const actions: string[] = []
  for (const type of types) {
    const label = PROSPECT_RECOMMENDATION_TYPE_LABELS[type]
    if (!actions.includes(label)) actions.push(label)
  }
  return actions.slice(0, 6)
}

function dedupeHash(execution_run_id: string, company_id: string, recommendation_type: string): string {
  return `${execution_run_id}:${company_id}:${recommendation_type}`
}

function buildRecommendationForType(
  input: GenerateProspectRecommendationsInput,
  company: GrowthProspectSearchCompanyResult,
  type: ProspectRecommendationType,
  priorityResult: ReturnType<typeof buildProspectPriorityScore>,
  allTypes: ProspectRecommendationType[],
): ProspectRecommendation {
  const now = new Date().toISOString()
  const lead_id = company.growth_lead_id ?? company.lead_inbox_id ?? null
  const impact = estimateRevenueImpact(company, priorityResult.score)
  const scoreInput = buildProspectPriorityScoreInputFromCompany(company, input.search_industry_hint)

  return {
    qa_marker: PROSPECT_RECOMMENDATION_QA_MARKER,
    recommendation_id: `${input.execution_run_id}:${company.id}:${type}`,
    execution_run_id: input.execution_run_id,
    lead_id,
    company_id: company.id,
    company_name: company.company_name,
    recommendation_type: type,
    priority: priorityResult.priority,
    confidence: priorityResult.confidence,
    reasoning: reasoningForType(type, company, priorityResult.factors),
    signals: company.signals ?? [],
    qualification_score: scoreInput.qualification_score,
    engagement_score: scoreInput.engagement_score,
    opportunity_score: scoreInput.opportunity_score,
    estimated_revenue_impact: impact,
    recommended_actions: recommendedActionsForTypes(allTypes),
    status: "new",
    dedupe_hash: dedupeHash(input.execution_run_id, company.id, type),
    collapsed_count: 1,
    created_at: now,
    requires_human_approval: true,
    enrollment_enabled: false,
    outreach_enabled: false,
  }
}

export function collapseProspectRecommendations(recommendations: ProspectRecommendation[]): {
  items: ProspectRecommendation[]
  collapsed_from: number
} {
  const byHash = new Map<string, ProspectRecommendation>()

  for (const item of recommendations) {
    const existing = byHash.get(item.dedupe_hash)
    if (!existing) {
      byHash.set(item.dedupe_hash, item)
      continue
    }
    existing.collapsed_count += 1
    if (item.confidence > existing.confidence) {
      byHash.set(item.dedupe_hash, { ...item, collapsed_count: existing.collapsed_count })
    }
  }

  const items = [...byHash.values()]
  return { items, collapsed_from: recommendations.length - items.length }
}

export function generateProspectRecommendations(
  input: GenerateProspectRecommendationsInput,
): ProspectRecommendation[] {
  const qualified = new Set(input.qualified_company_ids ?? [])
  const sourceCompanies =
    qualified.size > 0
      ? input.companies.filter((company) => qualified.has(company.id))
      : input.companies

  const recommendations: ProspectRecommendation[] = []

  for (const company of sourceCompanies) {
    const scoreInput = buildProspectPriorityScoreInputFromCompany(company, input.search_industry_hint)
    const priorityResult = buildProspectPriorityScore(scoreInput)
    const types = recommendationTypesForCompany(company, input.search_industry_hint)

    for (const type of types) {
      recommendations.push(
        buildRecommendationForType(input, company, type, priorityResult, types),
      )
    }
  }

  return collapseProspectRecommendations(recommendations).items.sort((a, b) => {
    const priorityRank = (p: string) =>
      p === "urgent" ? 4 : p === "high" ? 3 : p === "medium" ? 2 : 1
    const byPriority = priorityRank(b.priority) - priorityRank(a.priority)
    if (byPriority !== 0) return byPriority
    return b.confidence - a.confidence
  })
}
