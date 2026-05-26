/** Client-safe types for Prospect Search admin UI (Prompt 23). */

export { GROWTH_PROSPECT_SEARCH_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-types"
export { GROWTH_EXTERNAL_COMPANY_DISCOVERY_QA_MARKER } from "@/lib/growth/external-discovery/external-discovery-types"
export { GROWTH_CONTACT_DISCOVERY_QA_MARKER } from "@/lib/growth/contact-discovery/contact-discovery-types"

/** UX layer marker (Prompt 24) — also defined in prospect-search-ux-constants. */
export const GROWTH_PROSPECT_SEARCH_UX_QA_MARKER = "growth-prospect-search-ux-v1" as const

export type GrowthProspectSearchAdminExampleQuery = {
  label: string
  query: string
}

export const GROWTH_PROSPECT_SEARCH_EXAMPLE_QUERIES: GrowthProspectSearchAdminExampleQuery[] = [
  { label: "Medical equipment · TN", query: "medical equipment service companies Tennessee" },
  { label: "HVAC · 20–100 employees", query: "hvac companies 20-100 employees" },
  { label: "Biomedical field service · CA", query: "biomedical field service California" },
]
