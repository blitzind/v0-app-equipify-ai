/** GE-AVA-HOME-OPPORTUNITY-INTELLIGENCE-1A — Home dashboard API contract (client-safe). */

import type { OpportunityIntelligenceViewModel } from "@/lib/growth/opportunity-intelligence/opportunity-intelligence-view-model-types"

export const GROWTH_AVA_HOME_OPPORTUNITY_INTELLIGENCE_1A_QA_MARKER =
  "ge-ava-home-opportunity-intelligence-1a-v1" as const

export const GROWTH_HOME_OPPORTUNITY_INTELLIGENCE_API_PATH =
  "/api/platform/growth/leads" as const

export const GROWTH_HOME_DATAMOON_RECENT_IMPORTS_API_PATH =
  "/api/platform/growth/lead-sources/datamoon/recent-imports" as const

export const GROWTH_HOME_AVA_ANALYZE_LEAD_LABEL = "Analyze this lead" as const
export const GROWTH_HOME_AVA_REVIEW_DATAMOON_LABEL = "Review Datamoon imports" as const
export const GROWTH_HOME_AVA_SHOW_INTELLIGENCE_LABEL = "Show opportunity intelligence" as const

export type GrowthHomeOpportunityIntelligenceResearchStatus = {
  available: boolean
  workflowStatus: string | null
  updatedAt: string | null
  researchRunId: string | null
}

export type GrowthHomeOpportunityIntelligenceApiResponse = {
  ok: boolean
  readOnly?: true
  qa_marker?: typeof GROWTH_AVA_HOME_OPPORTUNITY_INTELLIGENCE_1A_QA_MARKER
  leadId?: string
  viewModel?: OpportunityIntelligenceViewModel
  researchStatus?: GrowthHomeOpportunityIntelligenceResearchStatus
  message?: string
}

export type GrowthHomeDatamoonRecentImportLead = {
  recordId: string
  runId: string
  leadId: string
  companyName: string | null
  contactName: string | null
  importedAt: string
}

export type GrowthHomeDatamoonRecentImportsApiResponse = {
  ok: boolean
  readOnly?: true
  leads?: GrowthHomeDatamoonRecentImportLead[]
  message?: string
}

export function growthHomeOpportunityIntelligenceHref(leadId: string): string {
  return `${GROWTH_HOME_OPPORTUNITY_INTELLIGENCE_API_PATH}/${encodeURIComponent(leadId)}/opportunity-intelligence`
}
