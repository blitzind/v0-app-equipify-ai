/** Build reusable Prospect Search Plan from parsed intent (client-safe). */

import type { GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"
import {
  PROSPECT_DISCOVERY_QA_MARKER,
  type NormalizedProspectSearchIntent,
  type ProspectDiscoveryProvider,
  type ProspectSearchIntent,
  type ProspectSearchPlan,
  type ProspectSearchResultQuality,
} from "@/lib/growth/prospect-discovery/prospect-search-intent-types"
import { normalizeProspectSearchIntent } from "@/lib/growth/prospect-discovery/prospect-search-normalizer"

function cloneFilters(filters: GrowthProspectSearchFilters): GrowthProspectSearchFilters {
  return JSON.parse(JSON.stringify(filters)) as GrowthProspectSearchFilters
}

function selectDiscoveryProviders(intent: NormalizedProspectSearchIntent): ProspectDiscoveryProvider[] {
  const providers: ProspectDiscoveryProvider[] = []

  const hasCompanyTargeting =
    intent.industries.length > 0 ||
    intent.locations.length > 0 ||
    intent.keywords.length > 0 ||
    intent.technologies.length > 0

  if (hasCompanyTargeting) {
    providers.push("real_world_google_places", "real_world_serp", "real_world_business_directory")
    providers.push("website_discovery")
    providers.push("apollo_company_search")
  }

  if (intent.titles.length > 0 || intent.prospect_search_filters.decision_maker_role) {
    providers.push("apollo_people_search", "pdl_search", "buying_committee_expansion")
  } else if (hasCompanyTargeting) {
    providers.push("apollo_people_search", "pdl_search")
  }

  if (intent.signals.length > 0) {
    providers.push("signal_enrichment")
  }

  if (hasCompanyTargeting) {
    providers.push("company_intelligence")
  }

  return [...new Set(providers)]
}

function estimateResultQuality(intent: NormalizedProspectSearchIntent): ProspectSearchResultQuality {
  let score = 0
  if (intent.industries.length) score += 2
  if (intent.locations.length) score += 2
  if (intent.employee_ranges.length) score += 1
  if (intent.technologies.length) score += 1
  if (intent.signals.length) score += 1
  if (intent.titles.length) score += 1
  if (intent.keywords.length >= 2) score += 1

  if (score >= 6) return "high"
  if (score >= 3) return "medium"
  return "low"
}

function buildWarnings(intent: NormalizedProspectSearchIntent): string[] {
  const warnings: string[] = []
  if (intent.locations.length === 0) {
    warnings.push("No geography — real-world discovery providers need a location before execution.")
  }
  if (intent.industries.length === 0) {
    warnings.push("No industry detected — results may be too broad without refinement.")
  }
  if (intent.exclusions.length) {
    warnings.push("Exclusions captured in intent but not yet applied in GS-2A plan filters.")
  }
  if (intent.signals.length && !intent.industries.length) {
    warnings.push("Signal-only query — enrichment providers recommended after company discovery.")
  }
  warnings.push("GS-2A produces a plan only — search execution requires human approval in GS-2B.")
  return warnings
}

function buildRecommendations(
  intent: NormalizedProspectSearchIntent,
  providers: ProspectDiscoveryProvider[],
): string[] {
  const recs: string[] = []

  if (intent.industries.some((i) => /biomedical|medical/i.test(i))) {
    recs.push("Consider Biomedical Expansion playbook after discovery for sequence alignment.")
  }
  if (intent.signals.includes("hiring")) {
    recs.push("Prioritize companies with recent hiring signals for expansion outreach.")
  }
  if (intent.signals.includes("funding")) {
    recs.push("Review funding events for opportunity readiness before outreach.")
  }
  if (intent.technologies.includes("Salesforce")) {
    recs.push("Technology stack fit may support competitive positioning sequences.")
  }
  if (providers.includes("buying_committee_expansion")) {
    recs.push("Run buying committee expansion after primary contacts are identified.")
  }
  if (intent.titles.length === 0) {
    recs.push("Add decision-maker titles (e.g. Operations Director, Service Manager) to improve people discovery.")
  }
  if (intent.employee_ranges.length === 0) {
    recs.push("Specify employee count (e.g. 10–100) to improve qualification precision.")
  }
  recs.push("Review parsed filters and approve plan before enabling search in GS-2B.")

  return recs
}

function buildEnrichmentRequirements(
  intent: NormalizedProspectSearchIntent,
  providers: ProspectDiscoveryProvider[],
): string[] {
  const reqs: string[] = []
  if (providers.includes("company_intelligence")) reqs.push("company_intelligence_profile")
  if (providers.includes("signal_enrichment")) reqs.push("growth_signal_rollup")
  if (intent.signals.includes("website_intent")) reqs.push("search_intent_capture")
  if (providers.includes("buying_committee_expansion")) reqs.push("buying_committee_roles")
  if (intent.prospect_search_filters.engine_verified_email) reqs.push("verified_email")
  return reqs
}

function buildProviderFilters(
  intent: NormalizedProspectSearchIntent,
  providers: ProspectDiscoveryProvider[],
): Partial<Record<ProspectDiscoveryProvider, GrowthProspectSearchFilters>> {
  const base = cloneFilters(intent.prospect_search_filters)
  const out: Partial<Record<ProspectDiscoveryProvider, GrowthProspectSearchFilters>> = {}

  for (const provider of providers) {
    if (
      provider === "real_world_google_places" ||
      provider === "real_world_serp" ||
      provider === "real_world_business_directory" ||
      provider === "website_discovery" ||
      provider === "apollo_company_search"
    ) {
      out[provider] = { ...base, source_types: ["external_discovered"] }
    } else if (provider === "apollo_people_search" || provider === "pdl_search") {
      out[provider] = {
        ...base,
        title_contains: intent.titles[0] ?? base.title_contains ?? null,
        decision_maker_role: base.decision_maker_role ?? null,
      }
    } else if (provider === "signal_enrichment") {
      out[provider] = {
        ...base,
        growth_signal_score_min: base.growth_signal_score_min ?? 30,
      }
    } else if (provider === "company_intelligence") {
      out[provider] = base
    } else if (provider === "buying_committee_expansion") {
      out[provider] = {
        ...base,
        buying_committee_roles: base.buying_committee_roles,
      }
    }
  }

  return out
}

function buildQualificationFilters(intent: NormalizedProspectSearchIntent): GrowthProspectSearchFilters {
  return {
    ...cloneFilters(intent.prospect_search_filters),
    company_identification_confidence_min: 50,
    existing_account_mode: "exclude_customers",
    suppression_mode: "exclude",
  }
}

/**
 * Build a Prospect Search Plan from parsed intent.
 * Planning only — no provider execution, no enrollment, no outreach.
 */
export function buildProspectSearchPlan(input: ProspectSearchIntent | NormalizedProspectSearchIntent): ProspectSearchPlan {
  const normalized =
    "prospect_search_filters" in input ? input : normalizeProspectSearchIntent(input)

  const discovery_providers = selectDiscoveryProviders(normalized)
  const estimated_result_quality = estimateResultQuality(normalized)

  return {
    qa_marker: PROSPECT_DISCOVERY_QA_MARKER,
    normalized_intent: normalized,
    discovery_providers,
    provider_filters: buildProviderFilters(normalized, discovery_providers),
    qualification_filters: buildQualificationFilters(normalized),
    signal_filters: normalized.signals,
    enrichment_requirements: buildEnrichmentRequirements(normalized, discovery_providers),
    estimated_result_quality,
    warnings: buildWarnings(normalized),
    recommendations: buildRecommendations(normalized, discovery_providers),
    requires_human_review: true,
    search_execution_enabled: false,
  }
}
