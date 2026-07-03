/** GE-AVA-DATAMOON-SOURCING-WORKBENCH-1A — Growth Home Datamoon sourcing API contract (client-safe). */

import type { AvaDatamoonSourcingDraftResult } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import { GROWTH_AVA_DATAMOON_SOURCING_WORKBENCH_1A_QA_MARKER } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"

export { GROWTH_AVA_DATAMOON_SOURCING_WORKBENCH_1A_QA_MARKER }

export const GROWTH_HOME_DATAMOON_SOURCING_DRAFT_API_PATH =
  "/api/platform/growth/ava/datamoon-sourcing/draft" as const

export const GROWTH_HOME_DATAMOON_RUNS_API_PATH =
  "/api/platform/growth/lead-sources/datamoon/runs" as const

export const GROWTH_HOME_AVA_ASK_DRAFT_LABEL = "Ask Ava to Draft" as const
export const GROWTH_HOME_BUILD_AUDIENCE_LABEL = "Build Audience" as const
export const GROWTH_HOME_SAVE_SEARCH_LABEL = "Save Search" as const
export const GROWTH_HOME_REFRESH_SAVED_SEARCH_LABEL = "Refresh Saved Search" as const
export const GROWTH_HOME_RESET_SEARCH_LABEL = "Reset" as const
export const GROWTH_HOME_IMPORT_RECOMMENDED_LABEL = "Import Recommended" as const
export const GROWTH_HOME_IMPORT_SELECTED_LABEL = "Import Selected" as const
export const GROWTH_HOME_REJECT_SELECTED_LABEL = "Reject Selected" as const

export type GrowthHomeDatamoonSourcingDraftApiResponse = {
  ok: boolean
  qa_marker?: typeof GROWTH_AVA_DATAMOON_SOURCING_WORKBENCH_1A_QA_MARKER
  readOnly?: true
  draft?: AvaDatamoonSourcingDraftResult
  message?: string
}

export type GrowthHomeDatamoonSourcingDraftApiRequest = {
  command: string
}
