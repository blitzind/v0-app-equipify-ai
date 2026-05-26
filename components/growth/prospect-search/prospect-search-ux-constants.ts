/** Client-safe dictionaries for Prospect Search UX (Prompt 24). */

import type { GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_PROSPECT_SEARCH_UX_QA_MARKER = "growth-prospect-search-ux-v1" as const

export const PROSPECT_SEARCH_HERO_PLACEHOLDERS = [
  "medical equipment service companies California",
  "hvac companies 20-100 employees",
  "field service companies using Salesforce",
  "biomedical service directors Tennessee",
] as const

export const PROSPECT_SEARCH_INDUSTRIES = [
  "HVAC",
  "Biomedical",
  "Medical Equipment Service",
  "Electrical",
  "MEP",
  "Garage Door",
  "Locksmith",
  "Commercial Equipment",
  "Field Service",
  "Property Management",
  "Healthcare Field Service",
  "Medical Device Repair",
] as const

export const PROSPECT_SEARCH_EMPLOYEE_BANDS_UI = [
  "1-10",
  "11-20",
  "21-50",
  "51-100",
  "101-250",
  "251-500",
  "500+",
] as const

export type ProspectSearchEmployeeBandUi = (typeof PROSPECT_SEARCH_EMPLOYEE_BANDS_UI)[number]

export function employeeBandUiToBackend(band: ProspectSearchEmployeeBandUi): string[] {
  if (band === "500+") return ["501-1000", "1000+"]
  return [band]
}

export function employeeBandsBackendToUi(
  bands: string[] | undefined,
): ProspectSearchEmployeeBandUi[] {
  if (!bands?.length) return []
  const ui: ProspectSearchEmployeeBandUi[] = []
  for (const b of PROSPECT_SEARCH_EMPLOYEE_BANDS_UI) {
    const mapped = employeeBandUiToBackend(b)
    if (mapped.some((m) => bands.includes(m))) ui.push(b)
  }
  return ui
}

export const PROSPECT_SEARCH_LOCATIONS = [
  "California",
  "Texas",
  "Florida",
  "Tennessee",
  "Georgia",
  "North Carolina",
  "Ohio",
  "Pennsylvania",
  "New York",
  "Illinois",
  "Arizona",
  "Colorado",
  "Washington",
  "Virginia",
] as const

export const PROSPECT_SEARCH_TECHNOLOGIES = [
  "QuickBooks",
  "HubSpot",
  "Salesforce",
  "Housecall Pro",
  "ServiceTitan",
  "FieldPulse",
  "Zoho CRM",
  "Microsoft Dynamics",
] as const

export const PROSPECT_SEARCH_DECISION_ROLES = [
  "Owner",
  "Founder",
  "President",
  "CEO",
  "Service Director",
  "Operations Manager",
  "Field Service Director",
  "General Manager",
  "VP Operations",
] as const

export type ProspectSearchIntentPresetId =
  | "high_intent"
  | "returning_visitor"
  | "purchase_ready"
  | "vendor_evaluation"
  | "pricing_interest"
  | "demo_interest"

export const PROSPECT_SEARCH_INTENT_PRESETS: Array<{
  id: ProspectSearchIntentPresetId
  label: string
  description: string
}> = [
  { id: "high_intent", label: "High Intent", description: "Intent score ≥ 12" },
  { id: "returning_visitor", label: "Returning Visitor", description: "Repeat site sessions" },
  { id: "purchase_ready", label: "Purchase Ready", description: "Buying stage signal" },
  { id: "vendor_evaluation", label: "Vendor Evaluation", description: "Comparing vendors" },
  { id: "pricing_interest", label: "Pricing Interest", description: "Pricing research intent" },
  { id: "demo_interest", label: "Demo Interest", description: "Demo / trial intent" },
]

export function intentPresetToFilters(
  presetId: ProspectSearchIntentPresetId,
): Partial<GrowthProspectSearchFilters> {
  switch (presetId) {
    case "high_intent":
      return { intent_score_min: 12 }
    case "returning_visitor":
      return { returning_visitor_only: true }
    case "purchase_ready":
      return { buying_stages: ["purchase_ready"] }
    case "vendor_evaluation":
      return { buying_stages: ["vendor_evaluation"] }
    case "pricing_interest":
      return { search_intent_categories: ["pricing_research"] }
    case "demo_interest":
      return { search_intent_categories: ["demo_intent"] }
    default:
      return {}
  }
}

export type ProspectSearchIcpTemplate = {
  id: string
  name: string
  description: string
  query: string
  filters: Partial<GrowthProspectSearchFilters>
}

export const PROSPECT_SEARCH_ICP_TEMPLATES: ProspectSearchIcpTemplate[] = [
  {
    id: "medical-equipment",
    name: "Medical Equipment Service",
    description: "Service companies maintaining clinical & facility equipment",
    query: "medical equipment service companies",
    filters: { industry: "Medical Equipment Service", employee_size_bands: ["21-50", "51-100"] },
  },
  {
    id: "biomedical",
    name: "Biomedical Field Service",
    description: "Biomedical repair & field service operators",
    query: "biomedical field service",
    filters: { industry: "Biomedical", keywords: ["biomedical", "field service"] },
  },
  {
    id: "hvac",
    name: "HVAC Companies",
    description: "Commercial HVAC contractors & service",
    query: "hvac companies 20-100 employees",
    filters: { industry: "HVAC", employee_size_bands: ["21-50", "51-100"] },
  },
  {
    id: "electrical",
    name: "Commercial Electrical",
    description: "Electrical contractors & MEP-adjacent service",
    query: "commercial electrical contractors",
    filters: { industry: "Electrical" },
  },
  {
    id: "garage-door",
    name: "Garage Door",
    description: "Garage door install & repair operators",
    query: "garage door service companies",
    filters: { industry: "Garage Door" },
  },
  {
    id: "field-service-smb",
    name: "Field Service SMB",
    description: "SMB field service with modern stack signals",
    query: "field service companies 20-100 employees",
    filters: {
      industry: "Field Service",
      employee_size_bands: ["21-50", "51-100"],
      field_service_software: "ServiceTitan",
    },
  },
  {
    id: "locksmith",
    name: "Locksmith",
    description: "Commercial locksmith & security service",
    query: "commercial locksmith companies",
    filters: { industry: "Locksmith" },
  },
  {
    id: "property-mgmt",
    name: "Property Management",
    description: "Property & facilities management operators",
    query: "property management maintenance companies",
    filters: { industry: "Property Management" },
  },
]

export const PROSPECT_SEARCH_SUGGESTED_SEARCHES = [
  { label: "HVAC · 51–100 employees", query: "hvac companies 51-100 employees Texas" },
  { label: "Biomedical · California", query: "biomedical field service California" },
  { label: "Medical equipment · TN", query: "medical equipment service companies Tennessee" },
  { label: "Salesforce stack", query: "field service companies using Salesforce" },
] as const

export const PROSPECT_SEARCH_POPULAR_INDUSTRIES = [
  "HVAC",
  "Field Service",
  "Medical Equipment Service",
  "Biomedical",
  "Electrical",
] as const
