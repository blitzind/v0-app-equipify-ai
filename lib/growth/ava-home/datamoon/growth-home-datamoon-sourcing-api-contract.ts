/** GE-AVA-DATAMOON-SOURCING-WORKBENCH-1A / GE-AIOS-BUSINESS-PROFILE-1C / GE-AIOS-GROWTH-UX-RENAME-1A / GE-AIOS-FIND-LEADS-UX-2A — Growth Home Find Leads API contract (client-safe). */

import type { AvaDatamoonSourcingDraftResult } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import { GROWTH_AVA_DATAMOON_SOURCING_WORKBENCH_1A_QA_MARKER } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import { GROWTH_AIOS_BUSINESS_PROFILE_1C_QA_MARKER } from "@/lib/growth/business-profile/business-profile-lead-discovery-projection"
import type { AiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"
import { askTeammatePlaceholder, askTeammateTab, importRecommendations, recommends } from "@/lib/workspace/ai-teammate-voice"

export { GROWTH_AVA_DATAMOON_SOURCING_WORKBENCH_1A_QA_MARKER, GROWTH_AIOS_BUSINESS_PROFILE_1C_QA_MARKER }

export const GROWTH_AIOS_GROWTH_UX_RENAME_1A_QA_MARKER = "ge-aios-growth-ux-rename-1a-v1" as const
export const GROWTH_AIOS_FIND_LEADS_UX_2A_QA_MARKER = "ge-aios-find-leads-ux-2a-v1" as const
export { GROWTH_AIOS_FIND_LEADS_7C_QA_MARKER } from "@/lib/growth/ava-home/datamoon/ava-datamoon-lead-discovery-defaults"
export const GROWTH_AVA_MISSION_RUNTIME_1B_FIND_LEADS_BINDING_QA_MARKER =
  "ge-ava-mission-runtime-1b-v1" as const

export const GROWTH_HOME_FIND_LEADS_TITLE = "Find Leads" as const
export const growthHomeFindLeadsSubtitle = (teammate: AiTeammatePresentation) =>
  `Ask ${teammate.name} to find companies that match your Growth Profile.`
/** @deprecated Use growthHomeFindLeadsSubtitle with the resolved teammate. */
export const GROWTH_HOME_FIND_LEADS_SUBTITLE = "Find companies that match your Growth Profile." as const
export const GROWTH_HOME_FIND_LEADS_CTA = "Find Leads" as const
export const growthHomeFindLeadsCardApprovedCopy = (teammate: AiTeammatePresentation) =>
  `Your Growth Profile is ready. Tell ${teammate.name} who you'd like to find—or let ${teammate.objectPronoun} recommend the best opportunities.`
export const growthHomeFindLeadsCardMissingCopy = (teammate: AiTeammatePresentation) =>
  `${teammate.name} can automatically find companies that match your ideal customer once ${teammate.subjectPronoun.toLowerCase()} understands your business.`
/** @deprecated Use the presentation-aware builders above. */
export const GROWTH_HOME_FIND_LEADS_CARD_APPROVED_COPY = "Your Growth Profile is ready to find opportunities." as const
/** @deprecated Use the presentation-aware builders above. */
export const GROWTH_HOME_FIND_LEADS_CARD_MISSING_COPY = "Complete your Growth Profile to find ideal customers." as const
export const GROWTH_HOME_FIND_LEADS_CARD_CONTINUE_MANUAL_LABEL = "Continue with Manual Search" as const
/** @deprecated Use GROWTH_HOME_FIND_LEADS_CARD_MISSING_COPY — kept for test compatibility */
export const GROWTH_HOME_FIND_LEADS_CARD_MISSING_PROFILE_COPY = "Growth Profile required" as const
export const growthHomeFindLeadsSecondaryCopy = (teammate: AiTeammatePresentation) =>
  `${teammate.name} will draft a search from your Growth Profile. You can edit everything before ${teammate.subjectPronoun.toLowerCase()} searches.`

export const GROWTH_HOME_FIND_LEADS_HERO_TITLE = "Who would you like me to find?" as const
export const growthHomeFindLeadsHeroSubtitle = (teammate: AiTeammatePresentation) =>
  `Tell ${teammate.name} about the kinds of companies you're looking for. ${teammate.subjectPronoun} will prepare the search using your approved Growth Profile.`
/** @deprecated Use growthHomeFindLeadsHeroSubtitle with the resolved teammate. */
export const GROWTH_HOME_FIND_LEADS_HERO_SUBTITLE = "Describe the kinds of companies you are looking for." as const
export const GROWTH_HOME_FIND_LEADS_HERO_PLACEHOLDER =
  "Examples:\n• Find roofing companies in Florida showing buying intent\n• Find HVAC companies with 10–100 employees\n• Find manufacturers replacing legacy ERP\n• Find medical equipment service companies" as const

export const GROWTH_HOME_FIND_LEADS_PLAN_TITLE = "Here's the search I prepared" as const
export const GROWTH_HOME_FIND_LEADS_PLAN_USING_LABEL = "Using:" as const
export const GROWTH_HOME_FIND_LEADS_PLAN_LOOKING_FOR_LABEL = "Looking for:" as const
export const GROWTH_HOME_FIND_LEADS_ASSUMPTIONS_TITLE = "My assumptions" as const
export const GROWTH_HOME_FIND_LEADS_UNSURE_TITLE = "I wasn't sure about" as const
export const GROWTH_HOME_FIND_LEADS_LOOKS_GOOD_LABEL = "Looks Good" as const
export const GROWTH_HOME_FIND_LEADS_EDIT_SEARCH_LABEL = "Edit Search" as const

export const growthHomeFindLeadsDrawerDescription = (teammate: AiTeammatePresentation) =>
  `${teammate.name} prepares the search from your Growth Profile. Advanced Search is available if you want to edit manually.`
/** @deprecated Use growthHomeFindLeadsDrawerDescription with the resolved teammate. */
export const GROWTH_HOME_FIND_LEADS_DRAWER_DESCRIPTION = "Prepare a search from your Growth Profile." as const
export const GROWTH_HOME_AVA_LED_SEARCH_TITLE = "Here's how I'll search" as const
export const GROWTH_HOME_AVA_LED_SEARCH_EXPLAIN_TITLE = "Why I'm searching this way" as const
export const GROWTH_HOME_START_LEAD_SEARCH_LABEL = "Start Lead Search" as const
export const GROWTH_HOME_REFINE_SEARCH_LABEL = "Refine with a command" as const
export const growthHomeAskTeammateTabLabel = askTeammateTab
/** @deprecated Use growthHomeAskTeammateTabLabel with the resolved teammate. */
export const GROWTH_HOME_ASK_AVA_TAB_LABEL = "Ask your AI teammate" as const
export const GROWTH_HOME_ADVANCED_SEARCH_TAB_LABEL = "Advanced Search" as const
export const growthHomeAskTeammatePlaceholder = askTeammatePlaceholder
export const GROWTH_HOME_ADVANCED_SEARCH_SECTION_LABEL = "Advanced Search" as const
export const GROWTH_HOME_ADVANCED_PROVIDER_DETAILS_LABEL = "Advanced Provider Details" as const
export const GROWTH_HOME_DISCOVERY_SOURCE_DATAMOON_LABEL = "Discovery source: Datamoon" as const
export const GROWTH_HOME_POWERED_BY_DATAMOON_LABEL = "Powered by Datamoon" as const
export const GROWTH_HOME_PROVIDER_MODE_LABEL = "Provider mode" as const

export const GROWTH_HOME_FIND_LEADS_APPROVAL_COPY =
  "I have reviewed this search and approve building this audience." as const

export const GROWTH_HOME_FIND_LEADS_MISSION_BINDING_TITLE = "Attach this search to a mission" as const
export const growthHomeFindLeadsMissionBindingCopy = (teammate: AiTeammatePresentation) =>
  `${teammate.name} can keep monitoring this search as part of a mission.`
/** @deprecated Use growthHomeFindLeadsMissionBindingCopy with the resolved teammate. */
export const GROWTH_HOME_FIND_LEADS_MISSION_BINDING_COPY = "Your AI teammate can monitor this search as part of a mission." as const
export const GROWTH_HOME_FIND_LEADS_MISSION_BINDING_MONITOR_LABEL =
  "Keep monitoring this search for new matching companies" as const
export const GROWTH_HOME_FIND_LEADS_MISSION_BINDING_SELECT_LABEL = "Mission" as const
export const GROWTH_HOME_FIND_LEADS_MISSION_BINDING_NONE_LABEL = "No mission (one-off search)" as const
export const GROWTH_HOME_FIND_LEADS_MISSION_BINDING_ATTACHED_COPY =
  "This search is attached to your mission for ongoing monitoring." as const
export const growthHomeFindLeadsResultsRecommendsTitle = recommends
/** @deprecated Use growthHomeFindLeadsResultsRecommendsTitle with the resolved teammate. */
export const GROWTH_HOME_FIND_LEADS_RESULTS_AVA_RECOMMENDS_TITLE = "Recommended for you" as const
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
export const growthHomeDatamoonBusinessProfileMissingCopy = (teammate: AiTeammatePresentation) =>
  `${teammate.name} needs a Growth Profile before ${teammate.subjectPronoun.toLowerCase()} can search accurately.`
export const growthHomeDatamoonProfileIncompleteCopy = (teammate: AiTeammatePresentation) =>
  `${teammate.name} needs a few more Growth Profile details before ${teammate.subjectPronoun.toLowerCase()} can run an accurate search.`
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
export const growthHomeImportRecommendedLabel = importRecommendations
/** @deprecated Use growthHomeImportRecommendedLabel with the resolved teammate. */
export const GROWTH_HOME_IMPORT_RECOMMENDED_LABEL = "Import Recommendations" as const
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
