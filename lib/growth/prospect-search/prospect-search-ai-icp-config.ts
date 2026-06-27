/** AI-first ICP read model for Prospect Search — client-safe, no provider calls. */

import type { GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_PROSPECT_SEARCH_AI_ICP_QA_MARKER = "growth-prospect-search-ai-icp-v1" as const

export const PROSPECT_SEARCH_AI_FIRST_HERO = {
  headline: "Find your next best accounts",
  supportingCopy:
    "Describe who you want to sell to, or let AI OS recommend the next market to search.",
  recommendCta: "Recommend my next search",
  manualCta: "Search manually",
} as const

export const PROSPECT_SEARCH_EXTERNAL_DISCOVERY_COPY =
  "Discover new companies from public business listings and directories. Review candidates before adding them to your pipeline." as const

export const PROSPECT_SEARCH_INTERNAL_DISCOVERY_COPY =
  "Search observable AI OS and CRM records. Review matches before taking action." as const

export type ProspectSearchAiIcpProfile = {
  companyLabel: string
  whatWeSell: string
  customerTypes: string[]
  industries: string[]
  workflows: string[]
  decisionMakers: string[]
  buyingSignals: string[]
  geography: string
  companySize: string
  disqualifiers: string[]
  buyingTriggers: string[]
}

/** Equipify operator defaults — placeholder until org-scoped ICP storage ships. */
export const EQUIPIFY_DEFAULT_AI_ICP_PROFILE: ProspectSearchAiIcpProfile = {
  companyLabel: "Equipify",
  whatWeSell:
    "Field service operations software for equipment-heavy businesses — work orders, dispatch, quotes, invoices, and recurring service workflows.",
  customerTypes: [
    "Field service companies",
    "Biomedical equipment service providers",
    "Calibration and service organizations",
  ],
  industries: [
    "Field Service",
    "Biomedical",
    "Medical Equipment Service",
    "Healthcare Field Service",
  ],
  workflows: [
    "Technician scheduling and dispatch",
    "Work orders and service history",
    "Quotes and invoicing",
    "Recurring maintenance and service contracts",
  ],
  decisionMakers: [
    "Owners and founders",
    "Operations leaders",
    "Service managers and directors",
    "Finance and admin leaders",
  ],
  buyingSignals: [
    "Growing service team without modern tooling",
    "Outdated quote and invoice workflows",
    "Technician scheduling complexity",
    "Spreadsheet-heavy dispatch and reporting",
  ],
  geography: "United States",
  companySize: "10–250 employees",
  disqualifiers: ["Pure retail with no service team", "Enterprise-only IT vendors"],
  buyingTriggers: [
    "Adding technicians or new service lines",
    "Replacing legacy FSM or accounting stack",
    "Customer SLA pressure and missed appointments",
  ],
}

export type ProspectSearchAiSearchSuggestion = {
  id: string
  title: string
  whyItFits: string
  buyerPain: string
  decisionMakers: string
  query: string
  filters: Partial<GrowthProspectSearchFilters>
}

export const PROSPECT_SEARCH_AI_SEARCH_SUGGESTIONS: ProspectSearchAiSearchSuggestion[] = [
  {
    id: "biomedical-us",
    title: "Biomedical equipment service companies in the U.S.",
    whyItFits:
      "High equipment density, recurring calibration cycles, and technician-heavy operations match Equipify’s service workflow strengths.",
    buyerPain:
      "Missed PM schedules, paper work orders, and slow quote-to-invoice cycles slow revenue recognition.",
    decisionMakers: "Service directors, operations managers, and owner-operators",
    query: "biomedical equipment service companies United States",
    filters: {
      industry: "Biomedical",
      employee_size_bands: ["21-50", "51-100"],
      keywords: ["biomedical", "equipment service"],
    },
  },
  {
    id: "calibration-field-service",
    title: "Independent calibration and field service companies",
    whyItFits:
      "Calibration shops run recurring routes, compliance paperwork, and multi-tech dispatch — a strong fit for structured service ops.",
    buyerPain:
      "Technician utilization is opaque, certificates and work orders live in disconnected tools, and billing lags completion.",
    decisionMakers: "Operations leaders, quality managers, and service managers",
    query: "calibration field service companies",
    filters: {
      industry: "Field Service",
      keywords: ["calibration", "field service"],
      employee_size_bands: ["11-20", "21-50", "51-100"],
    },
  },
  {
    id: "medical-repair-teams",
    title: "Medical equipment repair companies with service teams",
    whyItFits:
      "Repair operators with active technician benches need work order history, parts traceability, and invoice-ready job costing.",
    buyerPain:
      "Dispatch is reactive, repeat visits aren’t tracked, and finance lacks visibility into job profitability.",
    decisionMakers: "Service managers, general managers, and owners",
    query: "medical equipment repair companies with service teams",
    filters: {
      industry: "Medical Equipment Service",
      employee_size_bands: ["21-50", "51-100"],
      keywords: ["medical equipment", "repair", "service team"],
    },
  },
]

export const PROSPECT_SEARCH_ICP_SETUP_PLACEHOLDER_STORAGE_KEY =
  "equipify:growth-prospect-search-icp-draft/v1" as const
