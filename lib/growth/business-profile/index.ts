/** GE-AIOS-BUSINESS-PROFILE-1A — client-safe exports. */

export {
  GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER,
  GROWTH_AIOS_BUSINESS_PROFILE_SCHEMA_MIGRATION,
  BUSINESS_PROFILE_STATUSES,
  BUSINESS_PROFILE_DRAFT_LABEL,
  BUSINESS_PROFILE_APPROVED_LABEL,
  isBusinessProfileActive,
  type BusinessProfileStatus,
  type BusinessProfileInput,
  type BusinessProfileDraft,
  type ApprovedBusinessProfile,
  type RejectedBusinessProfile,
  type BusinessProfileRecord,
  type BusinessProfileDraftContent,
  type BusinessProfileCompanySection,
  type BusinessProfileIdealCustomersSection,
  type BusinessProfileProblemsSection,
  type BusinessProfileSalesMarketingSection,
  type BusinessProfileConfidenceSection,
} from "@/lib/growth/business-profile/business-profile-types"

export {
  draftBusinessProfileFromCompanyInput,
  type BusinessProfileDraftGeneratorMode,
  type BusinessProfileDraftGeneratorOptions,
} from "@/lib/growth/business-profile/business-profile-draft-generator"

export {
  GROWTH_BUSINESS_PROFILE_API_PATH,
  GROWTH_BUSINESS_PROFILE_DRAFT_LABEL,
  GROWTH_BUSINESS_PROFILE_APPROVE_LABEL,
  GROWTH_BUSINESS_PROFILE_REJECT_LABEL,
  GROWTH_BUSINESS_PROFILE_UPDATE_LABEL,
  GROWTH_BUSINESS_PROFILE_SECTION_TITLE,
  type GrowthBusinessProfileApiResponse,
  type GrowthBusinessProfileDraftRequest,
  type GrowthBusinessProfileUpdateRequest,
} from "@/lib/growth/business-profile/business-profile-api-contract"
