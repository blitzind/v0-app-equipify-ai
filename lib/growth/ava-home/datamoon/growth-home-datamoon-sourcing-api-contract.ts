/** GE-AVA-DATAMOON-SOURCING-WORKBENCH-1A / GE-AIOS-BUSINESS-PROFILE-1C / GE-AIOS-GROWTH-UX-RENAME-1A / GE-AIOS-FIND-LEADS-UX-2A — Growth Home Find Leads API contract (client-safe). */

import type { AvaDatamoonSourcingDraftResult } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import { GROWTH_AVA_DATAMOON_SOURCING_WORKBENCH_1A_QA_MARKER } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import { GROWTH_AIOS_BUSINESS_PROFILE_1C_QA_MARKER } from "@/lib/growth/business-profile/business-profile-lead-discovery-projection"

export { GROWTH_AVA_DATAMOON_SOURCING_WORKBENCH_1A_QA_MARKER, GROWTH_AIOS_BUSINESS_PROFILE_1C_QA_MARKER }

export const GROWTH_AIOS_GROWTH_UX_RENAME_1A_QA_MARKER = "ge-aios-growth-ux-rename-1a-v1" as const
export const GROWTH_AIOS_FIND_LEADS_UX_2A_QA_MARKER = "ge-aios-find-leads-ux-2a-v1" as const
export { GROWTH_AIOS_FIND_LEADS_7C_QA_MARKER } from "@/lib/growth/ava-home/datamoon/ava-datamoon-lead-discovery-defaults"
export const GROWTH_AVA_MISSION_RUNTIME_1B_FIND_LEADS_BINDING_QA_MARKER =
  "ge-ava-mission-runtime-1b-v1" as const

export const GROWTH_HOME_FIND_LEADS_TITLE = "Find Leads" as const
export const GROWTH_HOME_FIND_LEADS_SUBTITLE =
  "Ask Ava to find companies that match your Growth Profile." as const
export const GROWTH_HOME_FIND_LEADS_CTA = "Find Leads" as const
export const GROWTH_HOME_FIND_LEADS_CARD_APPROVED_COPY =
  "Your Growth Profile is ready. Tell Ava who you'd like to find—or let her recommend the best opportunities." as const
export const GROWTH_HOME_FIND_LEADS_CARD_MISSING_COPY =
  "Ava can automatically find companies that match your ideal customer once she understands your business." as const
export const GROWTH_HOME_FIND_LEADS_CARD_CONTINUE_MANUAL_LABEL = "Continue with Manual Search" as const
/** @deprecated Use GROWTH_HOME_FIND_LEADS_CARD_MISSING_COPY — kept for test compatibility */
export const GROWTH_HOME_FIND_LEADS_CARD_MISSING_PROFILE_COPY = GROWTH_HOME_FIND_LEADS_CARD_MISSING_COPY
export const GROWTH_HOME_FIND_LEADS_SECONDARY_COPY =
  "Ava will draft a search from your Growth Profile. You can edit everything before she searches." as const

export const GROWTH_HOME_FIND_LEADS_HERO_TITLE = "Who would you like me to find?" as const
export const GROWTH_HOME_FIND_LEADS_HERO_SUBTITLE =
  "Tell Ava about the kinds of companies you're looking for. She'll prepare the search using your approved Growth Profile." as const
export const GROWTH_HOME_FIND_LEADS_HERO_PLACEHOLDER =
  "Examples:\n• Find roofing companies in Florida showing buying intent\n• Find HVAC companies with 10–100 employees\n• Find manufacturers replacing legacy ERP\n• Find medical equipment service companies" as const

export const GROWTH_HOME_FIND_LEADS_PLAN_TITLE = "Here's the search I prepared" as const
export const GROWTH_HOME_FIND_LEADS_PLAN_USING_LABEL = "Using:" as const
export const GROWTH_HOME_FIND_LEADS_PLAN_LOOKING_FOR_LABEL = "Looking for:" as const
export const GROWTH_HOME_FIND_LEADS_ASSUMPTIONS_TITLE = "My assumptions" as const
export const GROWTH_HOME_FIND_LEADS_UNSURE_TITLE = "I wasn't sure about" as const
export const GROWTH_HOME_FIND_LEADS_LOOKS_GOOD_LABEL = "Looks Good" as const
export const GROWTH_HOME_FIND_LEADS_EDIT_SEARCH_LABEL = "Edit Search" as const

export const GROWTH_HOME_FIND_LEADS_DRAWER_DESCRIPTION =
  "Ava prepares the search from your Growth Profile. Advanced Search is available if you want to edit manually." as const
export const GROWTH_HOME_AVA_LED_SEARCH_TITLE = "Here's how I'll search" as const
export const GROWTH_HOME_AVA_LED_SEARCH_EXPLAIN_TITLE = "Why I'm searching this way" as const
export const GROWTH_HOME_START_LEAD_SEARCH_LABEL = "Start Lead Search" as const
export const GROWTH_HOME_REFINE_SEARCH_LABEL = "Refine with a command" as const
export const GROWTH_HOME_ASK_AVA_TAB_LABEL = "Ask Ava" as const
export const GROWTH_HOME_ADVANCED_SEARCH_TAB_LABEL = "Advanced Search" as const
export const GROWTH_HOME_ASK_AVA_PLACEHOLDER = "Tell Ava what kind of customers to find..." as const
export const GROWTH_HOME_ADVANCED_SEARCH_SECTION_LABEL = "Advanced Search" as const
export const GROWTH_HOME_ADVANCED_PROVIDER_DETAILS_LABEL = "Advanced Provider Details" as const
export const GROWTH_HOME_DISCOVERY_SOURCE_DATAMOON_LABEL = "Discovery source: Datamoon" as const
export const GROWTH_HOME_POWERED_BY_DATAMOON_LABEL = "Powered by Datamoon" as const
export const GROWTH_HOME_PROVIDER_MODE_LABEL = "Provider mode" as const

export const GROWTH_HOME_FIND_LEADS_APPROVAL_COPY =
  "I have reviewed this search and approve building this audience." as const

export const GROWTH_HOME_FIND_LEADS_MISSION_BINDING_TITLE = "Attach this search to a mission" as const
export const GROWTH_HOME_FIND_LEADS_MISSION_BINDING_COPY =
  "Ava can keep monitoring this search as part of a mission." as const
export const GROWTH_HOME_FIND_LEADS_MISSION_BINDING_MONITOR_LABEL =
  "Keep monitoring this search for new matching companies" as const
export const GROWTH_HOME_FIND_LEADS_MISSION_BINDING_SELECT_LABEL = "Mission" as const
export const GROWTH_HOME_FIND_LEADS_MISSION_BINDING_NONE_LABEL = "No mission (one-off search)" as const
export const GROWTH_HOME_FIND_LEADS_MISSION_BINDING_ATTACHED_COPY =
  "This search is attached to your mission for ongoing monitoring." as const
export const GROWTH_HOME_FIND_LEADS_RESULTS_AVA_RECOMMENDS_TITLE = "Ava recommends" as const
export const GROWTH_HOME_FIND_LEADS_RESULTS_AVA_RECOMMENDS_COPY =
  "These preview leads match your search criteria and intent filters. Review before importing—nothing is added until you choose." as const
export const GROWTH_HOME_FIND_LEADS_REVIEW_ALL_LABEL = "Review All Leads" as const

export const GROWTH_HOME_FIND_LEADS_EXAMPLES = [
  "Find roofing companies in Florida showing buying intent",
  "Find HVAC companies with 10–100 employees",
  "Find manufacturers replacing legacy ERP software",
  "Find medical equipment service companies",
  "Find companies hiring service technicians",
] as const

export const GROWTH_HOME_DATAMOON_USING_BUSINESS_PROFILE_LABEL = "Using approved Growth Profile" as const
export const GROWTH_HOME_DATAMOON_BUSINESS_PROFILE_STARTED_COPY =
  "I started with your approved Business Profile and adjusted the search based on your request." as const
export const GROWTH_HOME_DATAMOON_BUSINESS_PROFILE_MISSING_COPY =
  "Ava needs a Growth Profile before she can search accurately." as const
export const GROWTH_HOME_DATAMOON_PROFILE_INCOMPLETE_COPY =
  "Ava needs a few more Growth Profile details before she can run an accurate search." as const
export const GROWTH_HOME_DATAMOON_CREATE_BUSINESS_PROFILE_LABEL = "Update Growth Profile" as const
export const GROWTH_HOME_DATAMOON_CONTINUE_MANUALLY_LABEL = "Continue Manually" as const
export const GROWTH_HOME_BUSINESS_PROFILE_SECTION_SELECTOR = '[data-qa-section="home-business-profile"]' as const

export const GROWTH_HOME_DATAMOON_SOURCING_DRAFT_API_PATH =
  "/api/platform/growth/ava/datamoon-sourcing/draft" as const

export const GROWTH_HOME_DATAMOON_RUNS_API_PATH =
  "/api/platform/growth/lead-sources/datamoon/runs" as const

export const GROWTH_HOME_GENERATE_SEARCH_LABEL = "Generate Search" as const
/** Primary CTA after Ava prompt — Generate Search (GE-AIOS-FIND-LEADS-UX-2A) */
export const GROWTH_HOME_AVA_ASK_DRAFT_LABEL = GROWTH_HOME_GENERATE_SEARCH_LABEL
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
