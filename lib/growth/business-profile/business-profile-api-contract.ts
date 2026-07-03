/** GE-AIOS-BUSINESS-PROFILE-1A — Business Profile API contract (client-safe). */

import type { BusinessProfileDraftContent, BusinessProfileInput, BusinessProfileRecord } from "@/lib/growth/business-profile/business-profile-types"
import { GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER } from "@/lib/growth/business-profile/business-profile-types"

export { GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER }

export const GROWTH_BUSINESS_PROFILE_API_PATH = "/api/platform/growth/business-profile" as const

export const GROWTH_BUSINESS_PROFILE_DRAFT_LABEL = "Draft Business Profile" as const
export const GROWTH_BUSINESS_PROFILE_APPROVE_LABEL = "Approve" as const
export const GROWTH_BUSINESS_PROFILE_REJECT_LABEL = "Reject" as const
export const GROWTH_BUSINESS_PROFILE_UPDATE_LABEL = "Update Business Profile" as const
export const GROWTH_BUSINESS_PROFILE_SECTION_TITLE = "Teach Ava About Your Business" as const

export type GrowthBusinessProfileApiResponse = {
  ok: boolean
  qa_marker?: typeof GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER
  schemaReady?: boolean
  activeApproved?: BusinessProfileRecord | null
  latestDraft?: BusinessProfileRecord | null
  profile?: BusinessProfileRecord
  message?: string
}

export type GrowthBusinessProfileDraftRequest = BusinessProfileInput

export type GrowthBusinessProfileUpdateRequest = {
  companyName?: string
  website?: string
  profile?: BusinessProfileDraftContent
}
