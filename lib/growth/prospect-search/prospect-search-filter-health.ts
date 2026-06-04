/** Client-safe filter health warnings and relax suggestions for Prospect Search. */

import { parseTitleChips } from "@/lib/growth/prospect-search/title-suggestion-engine"
import { hasActiveProspectSearchEngineIntelligenceFilters } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-filters"
import {
  PROSPECT_SEARCH_BUYING_COMMITTEE_ROLE_LABELS,
  PROSPECT_SEARCH_COMPANY_INTELLIGENCE_CATEGORY_LABELS,
} from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-ux"
import type { GrowthCompanyIntelligenceCategory } from "@/lib/growth/company-intelligence/company-intelligence-types"
import type { GrowthBuyingCommitteeIntelligenceRole } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"
import type { GrowthProspectSearchDiscoveryMode, GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"
import { countActiveProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-estimation-format"

export type ProspectSearchActiveFilterChip = {
  id: string
  category: string
  label: string
  clear: Partial<GrowthProspectSearchFilters>
}

export function buildProspectSearchFilterHealthWarnings(input: {
  filters: GrowthProspectSearchFilters
  discovery_mode: GrowthProspectSearchDiscoveryMode
}): string[] {
  const warnings: string[] = []
  const external = input.discovery_mode === "discover_external"

  if (external && (input.filters.technologies?.length ?? 0) > 0) {
    warnings.push("Technology filters may reduce external matches.")
  }
  if (external && (input.filters.revenue_bands?.length ?? 0) > 0) {
    warnings.push("Revenue filters unavailable for many provider rows.")
  }
  if (external && (input.filters.employee_size_bands?.length ?? 0) > 0) {
    warnings.push("External companies often lack employee counts.")
  }
  if (external && input.filters.intent_signal_tiers?.length) {
    warnings.push("Intent signal tiers apply to internal records only.")
  }
  if (external && input.filters.buying_stages?.length) {
    warnings.push("Buying stage filters may drop provider-sourced companies.")
  }
  if ((input.filters.lead_score_min ?? 0) > 0 || (input.filters.lead_score_max ?? 0) > 0) {
    warnings.push("Lead score filters apply to indexed Growth records.")
  }
  if (hasActiveProspectSearchEngineIntelligenceFilters(input.filters)) {
    warnings.push(
      "Verified intelligence filters apply after search hydration — counts may be lower than the index estimate.",
    )
  }

  return warnings
}

export function buildProspectSearchRelaxSuggestions(input: {
  filters: GrowthProspectSearchFilters
  discovery_mode: GrowthProspectSearchDiscoveryMode
  estimated_count: number | null
}): string[] {
  const suggestions: string[] = []
  const count = input.estimated_count ?? 0
  const active = countActiveProspectSearchFilters(input.filters)
  if (active < 2 || count >= 10) return suggestions

  if (input.filters.revenue_bands?.length) {
    suggestions.push("Clear revenue bands")
  }
  if (input.filters.employee_size_bands?.length) {
    suggestions.push("Clear employee size bands")
  }
  if (input.filters.technologies?.length) {
    suggestions.push("Remove technology filters")
  }
  if (input.filters.intent_signal_tiers?.length) {
    suggestions.push("Remove intent signal tiers")
  }
  if (input.filters.buying_stages?.length) {
    suggestions.push("Clear buying stage filters")
  }
  if (input.filters.location || input.filters.territory_filter?.states?.length) {
    suggestions.push("Broaden location or territory")
  }
  if (input.filters.industry && input.discovery_mode === "discover_external") {
    suggestions.push("Use a broader industry keyword")
  }

  return suggestions.slice(0, 4)
}

function chip(
  id: string,
  category: string,
  label: string,
  clear: Partial<GrowthProspectSearchFilters>,
): ProspectSearchActiveFilterChip {
  return { id, category, label, clear }
}

export function buildProspectSearchActiveFilterChips(
  filters: GrowthProspectSearchFilters,
): ProspectSearchActiveFilterChip[] {
  const chips: ProspectSearchActiveFilterChip[] = []

  if (filters.industry) {
    chips.push(chip("industry", "Industry", filters.industry, { industry: null }))
  }
  if (filters.subindustry) {
    chips.push(chip("subindustry", "Industry", filters.subindustry, { subindustry: null }))
  }
  if (filters.location) {
    chips.push(chip("location", "Location", filters.location, { location: null }))
  }
  if (filters.employee_size_bands?.length) {
    chips.push(
      chip("employee", "Company size", filters.employee_size_bands.join(", "), {
        employee_size_bands: undefined,
      }),
    )
  }
  if (filters.revenue_bands?.length) {
    chips.push(
      chip("revenue", "Revenue", filters.revenue_bands.join(", "), { revenue_bands: undefined }),
    )
  }
  if (filters.technologies?.length) {
    for (const tech of filters.technologies) {
      const nextTechnologies = filters.technologies.filter((t) => t !== tech)
      chips.push(
        chip(`tech-${tech}`, "Technology", tech, {
          technologies: nextTechnologies.length ? nextTechnologies : undefined,
        }),
      )
    }
  }
  if (filters.intent_signal_tiers?.length) {
    chips.push(
      chip("intent", "Intent", filters.intent_signal_tiers.join(", "), {
        intent_signal_tiers: undefined,
      }),
    )
  }
  if (filters.buying_stages?.length) {
    chips.push(
      chip("buying", "Buying stage", filters.buying_stages.join(", "), {
        buying_stages: undefined,
      }),
    )
  }
  if (filters.territory_filter?.states?.length) {
    chips.push(
      chip("territory-states", "Territory", filters.territory_filter.states.join(", "), {
        territory_filter: {
          ...filters.territory_filter,
          states: undefined,
        },
      }),
    )
  }
  if (filters.territory_id) {
    chips.push(chip("territory-id", "Territory", "Saved territory", { territory_id: null }))
  }
  const titleChips = parseTitleChips(filters.title_contains ?? filters.decision_maker_role)
  if (titleChips.length) {
    chips.push(
      chip("titles", "Titles", titleChips.join(", "), {
        title_contains: null,
        decision_maker_role: null,
      }),
    )
  }
  if (filters.engine_verified_email) {
    chips.push(chip("engine-email", "Verified intel", "Verified email", { engine_verified_email: undefined }))
  }
  if (filters.engine_verified_phone) {
    chips.push(chip("engine-phone", "Verified intel", "Verified phone", { engine_verified_phone: undefined }))
  }
  if (filters.engine_verified_profile) {
    chips.push(
      chip("engine-profile", "Verified intel", "Verified profile", { engine_verified_profile: undefined }),
    )
  }
  if (filters.buying_committee_roles?.length) {
    chips.push(
      chip(
        "engine-roles",
        "Verified intel",
        filters.buying_committee_roles
          .map((r) => PROSPECT_SEARCH_BUYING_COMMITTEE_ROLE_LABELS[r as GrowthBuyingCommitteeIntelligenceRole] ?? r)
          .join(", "),
        { buying_committee_roles: undefined },
      ),
    )
  }
  if (filters.company_intelligence_categories?.length) {
    chips.push(
      chip(
        "engine-categories",
        "Verified intel",
        filters.company_intelligence_categories
          .map(
            (c) =>
              PROSPECT_SEARCH_COMPANY_INTELLIGENCE_CATEGORY_LABELS[c as GrowthCompanyIntelligenceCategory] ?? c,
          )
          .join(", "),
        { company_intelligence_categories: undefined },
      ),
    )
  }

  return chips
}

export function applyProspectSearchRelaxSuggestion(
  filters: GrowthProspectSearchFilters,
  suggestion: string,
): GrowthProspectSearchFilters {
  const next = { ...filters }
  switch (suggestion) {
    case "Clear revenue bands":
      delete next.revenue_bands
      break
    case "Clear employee size bands":
      delete next.employee_size_bands
      break
    case "Remove technology filters":
      delete next.technologies
      break
    case "Remove intent signal tiers":
      delete next.intent_signal_tiers
      break
    case "Clear buying stage filters":
      delete next.buying_stages
      break
    case "Broaden location or territory":
      delete next.location
      if (next.territory_filter) {
        next.territory_filter = { ...next.territory_filter, states: undefined, metros: undefined }
      }
      break
    case "Use a broader industry keyword":
      delete next.industry
      break
    default:
      break
  }
  return next
}
