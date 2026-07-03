/** GE-AVA-DATAMOON-SOURCING-WORKBENCH-1A / GE-AIOS-BUSINESS-PROFILE-1C / GE-AIOS-GROWTH-UX-RENAME-1A — Growth Home Find Leads API contract (client-safe). */

import type { AvaDatamoonSourcingDraftResult } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import { GROWTH_AVA_DATAMOON_SOURCING_WORKBENCH_1A_QA_MARKER } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import { GROWTH_AIOS_BUSINESS_PROFILE_1C_QA_MARKER } from "@/lib/growth/business-profile/business-profile-lead-discovery-projection"

export { GROWTH_AVA_DATAMOON_SOURCING_WORKBENCH_1A_QA_MARKER, GROWTH_AIOS_BUSINESS_PROFILE_1C_QA_MARKER }

export const GROWTH_AIOS_GROWTH_UX_RENAME_1A_QA_MARKER = "ge-aios-growth-ux-rename-1a-v1" as const

export const GROWTH_HOME_FIND_LEADS_TITLE = "Find Leads" as const
export const GROWTH_HOME_FIND_LEADS_SUBTITLE = "Tell Ava what kinds of companies you want to find." as const
export const GROWTH_HOME_FIND_LEADS_CTA = "Find Leads" as const
export const GROWTH_HOME_FIND_LEADS_SECONDARY_COPY =
  "Ava will draft a search from your Business Profile. You can edit everything before she searches." as const
export const GROWTH_HOME_FIND_LEADS_CARD_MISSING_PROFILE_COPY =
  "Create a Business Profile so Ava can make better recommendations." as const

export const GROWTH_HOME_FIND_LEADS_DRAWER_DESCRIPTION =
  "Ask Ava to draft a lead search, or use Advanced Search to configure it yourself." as const
export const GROWTH_HOME_ASK_AVA_TAB_LABEL = "Ask Ava" as const
export const GROWTH_HOME_ADVANCED_SEARCH_TAB_LABEL = "Advanced Search" as const
export const GROWTH_HOME_ASK_AVA_PLACEHOLDER = "Tell Ava what kind of customers to find..." as const
export const GROWTH_HOME_ADVANCED_SEARCH_SECTION_LABEL = "Advanced Search" as const
export const GROWTH_HOME_ADVANCED_PROVIDER_DETAILS_LABEL = "Advanced provider details" as const
export const GROWTH_HOME_DISCOVERY_SOURCE_DATAMOON_LABEL = "Discovery source: Datamoon" as const
export const GROWTH_HOME_POWERED_BY_DATAMOON_LABEL = "Powered by Datamoon" as const

export const GROWTH_HOME_FIND_LEADS_EXAMPLES = [
  "Find roofing companies in Florida showing buying intent",
  "Find HVAC companies with 10–100 employees",
  "Find manufacturers replacing legacy ERP software",
  "Find medical equipment service companies",
  "Find companies hiring service technicians",
] as const

export const GROWTH_HOME_DATAMOON_USING_BUSINESS_PROFILE_LABEL = "Using approved Business Profile" as const
export const GROWTH_HOME_DATAMOON_BUSINESS_PROFILE_STARTED_COPY =
  "I started with your approved Business Profile and adjusted the search based on your request." as const
export const GROWTH_HOME_DATAMOON_BUSINESS_PROFILE_MISSING_COPY =
  "Ava needs a Business Profile to make better recommendations." as const
export const GROWTH_HOME_DATAMOON_CREATE_BUSINESS_PROFILE_LABEL = "Create Business Profile" as const
export const GROWTH_HOME_DATAMOON_CONTINUE_MANUALLY_LABEL = "Continue Manually" as const
export const GROWTH_HOME_BUSINESS_PROFILE_SECTION_SELECTOR = '[data-qa-section="home-business-profile"]' as const

export const GROWTH_HOME_DATAMOON_SOURCING_DRAFT_API_PATH =
  "/api/platform/growth/ava/datamoon-sourcing/draft" as const

export const GROWTH_HOME_DATAMOON_RUNS_API_PATH =
  "/api/platform/growth/lead-sources/datamoon/runs" as const

export const GROWTH_HOME_AVA_ASK_DRAFT_LABEL = "Ask Ava" as const
export const GROWTH_HOME_BUILD_AUDIENCE_LABEL = "Search for Leads" as const
export const GROWTH_HOME_SAVE_SEARCH_LABEL = "Save Search" as const
export const GROWTH_HOME_REFRESH_SAVED_SEARCH_LABEL = "Refresh Saved Search" as const
export const GROWTH_HOME_RESET_SEARCH_LABEL = "Reset" as const
export const GROWTH_HOME_IMPORT_RECOMMENDED_LABEL = "Import Ava's Recommendations" as const
export const GROWTH_HOME_IMPORT_SELECTED_LABEL = "Import Selected Leads" as const
export const GROWTH_HOME_REJECT_SELECTED_LABEL = "Reject Selected" as const

export type GrowthHomeDatamoonSourcingDraftApiResponse = {
  ok: boolean
  qa_marker?: typeof GROWTH_AVA_DATAMOON_SOURCING_WORKBENCH_1A_QA_MARKER | typeof GROWTH_AIOS_BUSINESS_PROFILE_1C_QA_MARKER
  readOnly?: true
  draft?: AvaDatamoonSourcingDraftResult
  businessProfileUsed?: boolean
  businessProfileStatus?: "approved" | "missing"
  message?: string
}

export type GrowthHomeDatamoonSourcingDraftApiRequest = {
  command: string
}
