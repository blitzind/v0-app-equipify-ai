/** Territory prioritization — operational account intelligence by geo cluster. Client-safe. */

import {
  normalizeCity,
  normalizeMetro,
  normalizeState,
  normalizePostalCode,
} from "@/lib/growth/prospect-search/prospect-search-geo"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthProspectSearchPeopleResultRow } from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import type { ProspectSearchAccountOutreachReadinessTier } from "@/lib/growth/prospect-search/prospect-search-account-contact-strategy"

export const GROWTH_TERRITORY_PRIORITIZATION_QA_MARKER = "growth-territory-prioritization-v1" as const

export const TERRITORY_PRIORITY_TIERS = [
  "high_opportunity",
  "strong_coverage",
  "moderate",
  "research_gaps",
  "low_signal",
] as const

export type ProspectSearchTerritoryPriorityTier = (typeof TERRITORY_PRIORITY_TIERS)[number]

export type ProspectSearchTerritoryBucketKey = {
  label: string
  state: string | null
  city: string | null
  metro: string | null
  postal_code: string | null
}

export type ProspectSearchTerritoryIntelligenceMetrics = {
  company_density: number
  outreach_ready_account_count: number
  high_priority_account_count: number
  persona_completeness_avg: number
  verified_contact_coverage_pct: number
  call_ready_coverage_pct: number
  icp_alignment_avg: number
  buying_signal_concentration: number
  relationship_penetration_pct: number
  stale_coverage_pct: number
  blocked_suppressed_pct: number
  sequence_ready_account_count: number
  emerging_opportunity_count: number
  relationship_strengthening_pct: number
}

export type ProspectSearchTerritoryOpportunityScore = {
  qa_marker: typeof GROWTH_TERRITORY_PRIORITIZATION_QA_MARKER
  territory: ProspectSearchTerritoryBucketKey
  territory_score: number
  priority_tier: ProspectSearchTerritoryPriorityTier
  metrics: ProspectSearchTerritoryIntelligenceMetrics
  opportunity_reasons: string[]
  risks: string[]
  recommended_next_action: string
}

function resolveTerritoryBucket(company: GrowthProspectSearchCompanyResult): ProspectSearchTerritoryBucketKey {
  const state = normalizeState(company.state ?? company.location?.split(",").pop()?.trim() ?? null)
  const city = normalizeCity(company.city ?? null)
  const metro = normalizeMetro(company.metro ?? null)
  const postal_code = normalizePostalCode(company.postal_code ?? null)

  if (metro) {
    return { label: metro, state, city, metro, postal_code }
  }
  if (city && state) {
    return { label: `${city}, ${state}`, state, city, metro, postal_code }
  }
  if (state) {
    return { label: state, state, city, metro, postal_code }
  }
  if (postal_code) {
    return { label: postal_code, state, city, metro, postal_code }
  }
  return { label: company.location?.trim() || "Unspecified territory", state, city, metro, postal_code }
}

function bucketKey(bucket: ProspectSearchTerritoryBucketKey): string {
  return [bucket.metro, bucket.city, bucket.state, bucket.postal_code, bucket.label]
    .filter(Boolean)
    .join("|")
}

function isOutreachReady(tier: ProspectSearchAccountOutreachReadinessTier | undefined): boolean {
  return tier === "ready" || tier === "ready_with_review"
}

export function computeTerritoryOpportunityScore(input: {
  territory: ProspectSearchTerritoryBucketKey
  companies: GrowthProspectSearchCompanyResult[]
  peopleByCompany: Map<string, GrowthProspectSearchPeopleResultRow[]>
}): ProspectSearchTerritoryOpportunityScore {
  const { territory, companies, peopleByCompany } = input
  const total = companies.length

  let outreach_ready = 0
  let high_priority = 0
  let personaSum = 0
  let personaCount = 0
  let verifiedContacts = 0
  let totalContacts = 0
  let callReadyContacts = 0
  let icpSum = 0
  let signalSum = 0
  let relationshipHits = 0
  let staleContacts = 0
  let blockedOrSuppressed = 0
  let sequence_ready = 0
  let emerging_opportunity = 0
  let strengthening = 0

  for (const company of companies) {
    const strategy = company.contact_intelligence?.account_contact_strategy
    const tier = strategy?.account_outreach_readiness
    if (isOutreachReady(tier)) outreach_ready += 1
    if (tier === "ready") high_priority += 1
    if (company.in_lead_inbox || company.existing_prospect) relationshipHits += 1
    if (company.is_suppressed || tier === "blocked") blockedOrSuppressed += 1

    const seq = company.contact_intelligence?.sequence_readiness?.readiness_state
    if (seq === "ready" || seq === "ready_with_review") sequence_ready += 1

    const emergence = company.contact_intelligence?.opportunity_emergence?.emergence_tier
    if (
      emergence === "emerging" ||
      emergence === "accelerating" ||
      emergence === "outreach_ready"
    ) {
      emerging_opportunity += 1
    }

    if (
      company.contact_intelligence?.relationship_memory?.momentum_direction === "strengthening" ||
      company.contact_intelligence?.opportunity_emergence?.opportunity_trend === "improving"
    ) {
      strengthening += 1
    }

    icpSum += company.company_match_confidence ?? company.lead_engine_score ?? company.lead_score ?? 0
    signalSum += company.growth_signal_score ?? 0

    const coverage = company.contact_intelligence?.company_contact_coverage
    if (coverage?.persona_completeness != null) {
      personaSum += coverage.persona_completeness
      personaCount += 1
    }

    const people = peopleByCompany.get(company.id) ?? []
    for (const person of people) {
      totalContacts += 1
      if ((person.verification_status ?? "").includes("verified")) verifiedContacts += 1
      if (person.call_ready) callReadyContacts += 1
      if (person.freshness_status === "stale" || person.freshness_status === "expired") {
        staleContacts += 1
      }
      if (person.priority_tier === "blocked" || person.compliance_status === "suppressed") {
        blockedOrSuppressed += 1
      }
    }
  }

  const metrics: ProspectSearchTerritoryIntelligenceMetrics = {
    company_density: total,
    outreach_ready_account_count: outreach_ready,
    high_priority_account_count: high_priority,
    persona_completeness_avg:
      personaCount > 0 ? Math.round(personaSum / personaCount) : 0,
    verified_contact_coverage_pct:
      totalContacts > 0 ? Math.round((verifiedContacts / totalContacts) * 100) : 0,
    call_ready_coverage_pct:
      totalContacts > 0 ? Math.round((callReadyContacts / totalContacts) * 100) : 0,
    icp_alignment_avg:
      total > 0 ? Math.round(((icpSum / total) > 1 ? icpSum / total / 100 : icpSum / total) * 100) : 0,
    buying_signal_concentration:
      total > 0 ? Math.round(signalSum / total) : 0,
    relationship_penetration_pct:
      total > 0 ? Math.round((relationshipHits / total) * 100) : 0,
    stale_coverage_pct:
      totalContacts > 0 ? Math.round((staleContacts / totalContacts) * 100) : 0,
    blocked_suppressed_pct:
      total + totalContacts > 0
        ? Math.round((blockedOrSuppressed / (total + totalContacts)) * 100)
        : 0,
    sequence_ready_account_count: sequence_ready,
    emerging_opportunity_count: emerging_opportunity,
    relationship_strengthening_pct:
      total > 0 ? Math.round((strengthening / total) * 100) : 0,
  }

  let score = 0
  score += Math.min(30, outreach_ready * 4)
  score += Math.min(20, high_priority * 5)
  score += metrics.persona_completeness_avg * 0.15
  score += metrics.verified_contact_coverage_pct * 0.12
  score += metrics.call_ready_coverage_pct * 0.12
  score += metrics.icp_alignment_avg * 0.1
  score += metrics.buying_signal_concentration * 0.08
  score += metrics.relationship_penetration_pct * 0.05
  score += Math.min(8, metrics.sequence_ready_account_count * 2)
  score += Math.min(6, metrics.emerging_opportunity_count * 2)
  score += metrics.relationship_strengthening_pct * 0.04
  score -= metrics.stale_coverage_pct * 0.08
  score -= metrics.blocked_suppressed_pct * 0.1
  score = Math.round(Math.min(100, Math.max(0, score)))

  const opportunity_reasons: string[] = []
  const risks: string[] = []

  if (outreach_ready >= 3) {
    opportunity_reasons.push(`${outreach_ready} outreach-ready accounts in territory`)
  }
  if (metrics.call_ready_coverage_pct >= 50) {
    opportunity_reasons.push("Strong call-ready contact coverage")
  }
  if (metrics.icp_alignment_avg >= 70) {
    opportunity_reasons.push("High ICP alignment concentration")
  }
  if (metrics.persona_completeness_avg >= 60) {
    opportunity_reasons.push("Solid persona coverage across accounts")
  }
  if (metrics.sequence_ready_account_count >= 2) {
    opportunity_reasons.push(`${metrics.sequence_ready_account_count} sequence-ready accounts in territory`)
  }
  if (metrics.emerging_opportunity_count >= 2) {
    opportunity_reasons.push("Emerging opportunity density elevated")
  }
  if (metrics.stale_coverage_pct >= 40) {
    risks.push("Elevated stale contact coverage — refresh before outreach push")
  }
  if (metrics.persona_completeness_avg < 40) {
    risks.push("Weak decision-maker / operations persona coverage")
  }
  if (metrics.blocked_suppressed_pct >= 25) {
    risks.push("High blocked or suppressed rate in territory")
  }
  if (total === 0) {
    risks.push("No companies in territory cluster")
  }

  let priority_tier: ProspectSearchTerritoryPriorityTier = "moderate"
  if (score >= 75 && outreach_ready >= 2) priority_tier = "high_opportunity"
  else if (score >= 60 && metrics.call_ready_coverage_pct >= 40) priority_tier = "strong_coverage"
  else if (metrics.persona_completeness_avg < 35 || metrics.verified_contact_coverage_pct < 25) {
    priority_tier = "research_gaps"
  } else if (score < 30 || total <= 1) priority_tier = "low_signal"

  let recommended_next_action = "Review territory account mix before prioritizing outreach"
  if (priority_tier === "high_opportunity") {
    recommended_next_action = "Prioritize outreach-ready accounts — strong territory opportunity"
  } else if (priority_tier === "strong_coverage") {
    recommended_next_action = "Launch call-ready workflows — excellent contact coverage"
  } else if (priority_tier === "research_gaps") {
    recommended_next_action = "Run contact research — persona gaps across territory"
  } else if (priority_tier === "low_signal") {
    recommended_next_action = "Expand discovery or refine ICP filters for this territory"
  }

  if (territory.metro || territory.city) {
    opportunity_reasons.unshift(
      `Territory cluster: ${territory.label} (${total} companies)`,
    )
  }

  return {
    qa_marker: GROWTH_TERRITORY_PRIORITIZATION_QA_MARKER,
    territory,
    territory_score: score,
    priority_tier,
    metrics,
    opportunity_reasons: opportunity_reasons.slice(0, 5),
    risks: risks.slice(0, 4),
    recommended_next_action,
  }
}

export function aggregateProspectSearchTerritoryPrioritization(input: {
  companies: GrowthProspectSearchCompanyResult[]
  peopleRows: GrowthProspectSearchPeopleResultRow[]
}): ProspectSearchTerritoryOpportunityScore[] {
  const peopleByCompany = new Map<string, GrowthProspectSearchPeopleResultRow[]>()
  for (const row of input.peopleRows) {
    const list = peopleByCompany.get(row.company_id) ?? []
    list.push(row)
    peopleByCompany.set(row.company_id, list)
  }

  const groups = new Map<string, { bucket: ProspectSearchTerritoryBucketKey; companies: GrowthProspectSearchCompanyResult[] }>()
  for (const company of input.companies) {
    const bucket = resolveTerritoryBucket(company)
    const key = bucketKey(bucket)
    const group = groups.get(key) ?? { bucket, companies: [] }
    group.companies.push(company)
    groups.set(key, group)
  }

  return [...groups.values()]
    .map(({ bucket, companies }) =>
      computeTerritoryOpportunityScore({ territory: bucket, companies, peopleByCompany }),
    )
    .sort((a, b) => b.territory_score - a.territory_score)
}

export function resolveCompanyTerritoryOpportunityBoost(
  company: GrowthProspectSearchCompanyResult,
  territoryScores: ProspectSearchTerritoryOpportunityScore[],
): number {
  const bucket = resolveTerritoryBucket(company)
  const key = bucketKey(bucket)
  for (const territory of territoryScores) {
    if (bucketKey(territory.territory) === key) {
      return territory.territory_score * 0.08
    }
  }
  return 0
}

export function applyTerritoryOpportunityBoostToCompanies(
  companies: GrowthProspectSearchCompanyResult[],
  territoryScores: ProspectSearchTerritoryOpportunityScore[],
): GrowthProspectSearchCompanyResult[] {
  if (territoryScores.length === 0) return companies

  return companies.map((company) => {
    const boost = resolveCompanyTerritoryOpportunityBoost(company, territoryScores)
    const strategy = company.contact_intelligence?.account_contact_strategy
    if (boost <= 0 || !strategy) return company

    const roundedBoost = Math.round(boost)
    return {
      ...company,
      contact_intelligence: {
        ...company.contact_intelligence!,
        account_contact_strategy: {
          ...strategy,
          queue_priority_score: Math.round(Math.min(100, strategy.queue_priority_score + roundedBoost)),
          strategy_reasons: [...strategy.strategy_reasons, `Territory opportunity boost +${roundedBoost}`],
        },
      },
    }
  })
}
