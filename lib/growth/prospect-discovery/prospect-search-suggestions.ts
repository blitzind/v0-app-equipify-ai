/** Suggest refinements for incomplete prospect search intents (client-safe). */

import type {
  ProspectSearchIntent,
  ProspectSearchSuggestion,
  ProspectSearchSuggestionsResponse,
} from "@/lib/growth/prospect-discovery/prospect-search-intent-types"
import { PROSPECT_DISCOVERY_QA_MARKER } from "@/lib/growth/prospect-discovery/prospect-search-intent-types"
import { parseProspectSearchIntent } from "@/lib/growth/prospect-discovery/prospect-search-parser"

function hasOnlyTechnology(intent: ProspectSearchIntent): boolean {
  return intent.technologies.length > 0 && intent.industries.length === 0 && intent.signals.length === 0
}

function hasOnlyIndustry(intent: ProspectSearchIntent): boolean {
  return intent.industries.length > 0 && intent.locations.length === 0 && intent.employee_ranges.length === 0
}

function buildSuggestionsForIntent(intent: ProspectSearchIntent): ProspectSearchSuggestion[] {
  const suggestions: ProspectSearchSuggestion[] = []

  if (intent.employee_ranges.length === 0) {
    suggestions.push({
      id: "employee_count",
      label: "Add employee count",
      reason: "Employee size improves qualification and provider ranking.",
      field: "employee_ranges",
      examples: ["10-100 employees", "50+ employees", "20+ technicians"],
    })
  }

  if (intent.locations.length === 0) {
    suggestions.push({
      id: "geography",
      label: "Add geography",
      reason: "Real-world discovery requires a state, region, or service area.",
      field: "locations",
      examples: ["Texas", "southeast", "California"],
    })
  }

  if (intent.signals.length === 0) {
    suggestions.push({
      id: "signals",
      label: "Add buying signals",
      reason: "Signals help prioritize high-intent accounts after discovery.",
      field: "signals",
      examples: ["recent hiring signals", "raised funding", "website intent"],
    })
  }

  if (intent.technologies.length === 0 && !hasOnlyTechnology(intent)) {
    suggestions.push({
      id: "technologies",
      label: "Add technology stack",
      reason: "Tech stack filters improve fit for field service CRM targets.",
      field: "technologies",
      examples: ["Salesforce", "ServiceTitan", "HubSpot"],
    })
  }

  if (intent.titles.length === 0) {
    suggestions.push({
      id: "titles",
      label: "Add decision-maker titles",
      reason: "Titles enable Apollo/PDL people discovery in the plan.",
      field: "titles",
      examples: ["Operations Director", "Service Manager", "Owner"],
    })
  }

  if (hasOnlyIndustry(intent)) {
    suggestions.unshift({
      id: "industry_refinement",
      label: "Refine industry context",
      reason: "Industry-only queries benefit from size, geography, or service keywords.",
      field: "keywords",
      examples: ["servicing hospitals", "commercial HVAC", "medical devices"],
    })
  }

  if (hasOnlyTechnology(intent)) {
    suggestions.unshift({
      id: "industry_for_tech",
      label: "Add industry vertical",
      reason: "Technology-only queries span many verticals — add industry for precision.",
      field: "industries",
      examples: ["HVAC", "Biomedical", "Manufacturing"],
    })
    suggestions.push({
      id: "hiring_for_tech",
      label: "Add hiring signals",
      reason: "Hiring + tech stack often indicates expansion readiness.",
      field: "signals",
      examples: ["recent hiring", "hiring surge"],
    })
  }

  if (intent.industries.length === 0 && intent.technologies.length === 0) {
    suggestions.unshift({
      id: "industry",
      label: "Add industry",
      reason: "Start with a vertical to anchor discovery providers.",
      field: "industries",
      examples: ["Biomedical", "HVAC", "Field Service"],
    })
  }

  return suggestions.slice(0, 8)
}

/**
 * Build contextual suggestions from a raw query or parsed intent.
 */
export function buildProspectSearchSuggestions(input?: {
  query?: string | null
  intent?: ProspectSearchIntent | null
}): ProspectSearchSuggestionsResponse {
  const intent =
    input?.intent ??
    (input?.query?.trim() ? parseProspectSearchIntent(input.query.trim()) : null)

  const emptyIntent: ProspectSearchIntent = {
    raw_query: "",
    industries: [],
    locations: [],
    employee_ranges: [],
    revenue_ranges: [],
    titles: [],
    technologies: [],
    keywords: [],
    signals: [],
    exclusions: [],
    company_characteristics: [],
    confidence: 0,
    assumptions: [],
    ambiguities: [],
  }

  const resolved = intent ?? emptyIntent

  return {
    qa_marker: PROSPECT_DISCOVERY_QA_MARKER,
    suggestions: buildSuggestionsForIntent(resolved),
    based_on: {
      industries: resolved.industries,
      technologies: resolved.technologies,
      signals: resolved.signals,
      locations: resolved.locations,
      employee_ranges: resolved.employee_ranges,
      titles: resolved.titles,
    },
  }
}
