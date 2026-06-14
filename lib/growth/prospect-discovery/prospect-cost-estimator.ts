/** Deterministic cost and volume estimation for prospect execution plans (client-safe). */

import type { NormalizedProspectSearchIntent, ProspectDiscoveryProvider, ProspectSearchResultQuality } from "@/lib/growth/prospect-discovery/prospect-search-intent-types"
import type {
  ProspectBudgetGuardRailLevel,
  ProspectExecutionCostBreakdown,
} from "@/lib/growth/prospect-discovery/prospect-execution-plan-types"

function parseEmployeeMidpoint(ranges: string[]): number | null {
  for (const range of ranges) {
    const match = range.match(/(\d+)\s*-\s*(\d+)/)
    if (match) return (Number(match[1]) + Number(match[2])) / 2
    const plus = range.match(/(\d+)\+/)
    if (plus) return Number(plus[1]) * 1.25
  }
  return null
}

function breadthScore(intent: NormalizedProspectSearchIntent): number {
  let score = 0
  if (intent.locations.length >= 8) score += 3
  else if (intent.locations.length >= 3) score += 2
  else if (intent.locations.length === 0) score += 2
  if (intent.industries.length === 0) score += 2
  if (intent.employee_ranges.length === 0) score += 1
  if (intent.industries.length > 2) score += 1
  return score
}

export function estimateProspectExecutionVolume(input: {
  intent: NormalizedProspectSearchIntent
  providers: ProspectDiscoveryProvider[]
  result_quality: ProspectSearchResultQuality
}): { companies: number; contacts: number } {
  const { intent, providers, result_quality } = input
  const breadth = breadthScore(intent)
  const locationFactor = intent.locations.length === 0 ? 1.4 : Math.min(2.5, 0.6 + intent.locations.length * 0.15)
  const industryFactor = intent.industries.length === 0 ? 1.3 : 1
  const employeeMid = parseEmployeeMidpoint(intent.employee_ranges)
  const sizeFactor = employeeMid && employeeMid >= 200 ? 0.75 : employeeMid && employeeMid <= 30 ? 1.2 : 1

  let companies = 40
  if (result_quality === "high") companies = 55
  if (result_quality === "low") companies = 25
  companies = Math.round(companies * locationFactor * industryFactor * sizeFactor)
  companies = Math.max(10, Math.min(250, companies - breadth * 4))

  const contactProviders = providers.filter((p) =>
    ["apollo_people_search", "pdl_search", "website_discovery", "buying_committee_expansion"].includes(p),
  ).length
  const contactsPerCompany = contactProviders >= 3 ? 4 : contactProviders >= 2 ? 3 : 2
  const contacts = Math.round(companies * contactsPerCompany * (intent.titles.length > 0 ? 0.85 : 1))

  return { companies, contacts: Math.max(companies, contacts) }
}

export function estimateProspectExecutionCost(input: {
  intent: NormalizedProspectSearchIntent
  providers: ProspectDiscoveryProvider[]
  estimated_companies: number
  estimated_contacts: number
}): ProspectExecutionCostBreakdown {
  const { providers, estimated_companies, estimated_contacts } = input
  const companyDiscoveryCount = providers.filter((p) =>
    ["real_world_google_places", "real_world_serp", "real_world_business_directory", "apollo_company_search"].includes(p),
  ).length

  const apolloCompanies = providers.includes("apollo_company_search") || providers.includes("apollo_people_search")
    ? estimated_companies
    : 0
  const apolloContacts = providers.includes("apollo_people_search")
    ? Math.min(estimated_contacts, estimated_companies * 5)
    : 0

  const apollo_credits = Math.round(apolloCompanies * 0.2 + apolloContacts * 0.15)
  const pdl_lookup_units = providers.includes("pdl_search") ? Math.min(estimated_companies, 120) : 0
  const serp_requests = providers.includes("real_world_serp") ? Math.min(estimated_companies, 80) : 0
  const google_places_requests = providers.includes("real_world_google_places")
    ? Math.min(Math.max(10, estimated_companies), 100)
    : 0
  const website_crawl_pages = providers.includes("website_discovery")
    ? Math.min(estimated_companies * 3, 300)
    : 0

  const total_provider_units =
    apollo_credits +
    pdl_lookup_units +
    serp_requests +
    google_places_requests +
    Math.round(website_crawl_pages / 3) +
    (providers.includes("company_intelligence") ? estimated_companies : 0) +
    (providers.includes("signal_enrichment") ? Math.round(estimated_companies * 0.5) : 0)

  void companyDiscoveryCount

  return {
    apollo_credits,
    pdl_lookup_units,
    serp_requests,
    google_places_requests,
    website_crawl_pages,
    total_provider_units,
  }
}

export function estimateProspectExecutionRuntimeSeconds(input: {
  providers: ProspectDiscoveryProvider[]
  estimated_companies: number
  stages: number
}): number {
  const { providers, estimated_companies, stages } = input
  let seconds = 30 + stages * 12
  if (providers.includes("real_world_google_places")) seconds += 20
  if (providers.includes("real_world_serp")) seconds += 25
  if (providers.includes("website_discovery")) seconds += Math.min(120, estimated_companies * 0.8)
  if (providers.includes("apollo_people_search")) seconds += Math.min(90, estimated_companies * 0.6)
  if (providers.includes("pdl_search")) seconds += Math.min(60, estimated_companies * 0.4)
  if (providers.includes("buying_committee_expansion")) seconds += 20
  return Math.round(seconds)
}

export function classifyProspectBudgetGuardrail(input: {
  intent: NormalizedProspectSearchIntent
  cost: ProspectExecutionCostBreakdown
  estimated_companies: number
}): ProspectBudgetGuardRailLevel {
  const { intent, cost, estimated_companies } = input
  const breadth = breadthScore(intent)

  let score = 0
  if (cost.apollo_credits >= 80) score += 3
  else if (cost.apollo_credits >= 35) score += 2
  else if (cost.apollo_credits >= 10) score += 1

  if (cost.total_provider_units >= 400) score += 3
  else if (cost.total_provider_units >= 180) score += 2
  else if (cost.total_provider_units >= 70) score += 1

  if (estimated_companies >= 180) score += 2
  else if (estimated_companies >= 90) score += 1

  score += breadth

  if (score >= 7) return "expensive"
  if (score >= 5) return "high"
  if (score >= 3) return "medium"
  return "low"
}

export function buildProspectExecutionCostWarnings(input: {
  intent: NormalizedProspectSearchIntent
  budget_guardrail: ProspectBudgetGuardRailLevel
  cost: ProspectExecutionCostBreakdown
  estimated_companies: number
}): string[] {
  const warnings: string[] = []
  const { intent, budget_guardrail, cost, estimated_companies } = input

  if (intent.employee_ranges.length === 0) {
    warnings.push("Large default employee range may increase enrichment cost — specify employee count.")
  }
  if (intent.locations.length >= 8) {
    warnings.push("Nationwide or multi-region search detected — expect higher provider usage and runtime.")
  }
  if (intent.industries.length === 0) {
    warnings.push("Broad industry scope — qualification yield may be lower than targeted vertical searches.")
  }
  if (budget_guardrail === "high" || budget_guardrail === "expensive") {
    warnings.push(`Budget guardrail: ${budget_guardrail} — review estimated credits before approving execution.`)
  }
  if (cost.apollo_credits >= 50) {
    warnings.push(`Estimated Apollo credits (~${cost.apollo_credits}) — confirm credit budget with operator.`)
  }
  if (estimated_companies >= 150) {
    warnings.push("Estimated company volume is high — consider narrowing geography or employee filters.")
  }
  return warnings
}

export function buildProspectExecutionRisks(input: {
  intent: NormalizedProspectSearchIntent
  budget_guardrail: ProspectBudgetGuardRailLevel
}): string[] {
  const risks: string[] = []
  if (input.intent.locations.length === 0) {
    risks.push("Missing geography may produce low-precision company discovery results.")
  }
  if (input.budget_guardrail === "expensive") {
    risks.push("Expensive execution profile — provider costs may exceed typical pilot guardrails.")
  }
  if (input.intent.technologies.length > 0 && input.intent.industries.length === 0) {
    risks.push("Technology-only targeting may return contacts outside service vertical ICP.")
  }
  risks.push("GS-2B creates an execution plan only — no autonomous search, enrollment, or outreach.")
  return risks
}
