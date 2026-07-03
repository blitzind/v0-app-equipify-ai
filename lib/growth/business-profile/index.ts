/** GE-AIOS-BUSINESS-PROFILE-1A/1B — client-safe exports. */

export {
  GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER,
  GROWTH_AIOS_BUSINESS_PROFILE_1B_QA_MARKER,
  GROWTH_AIOS_BUSINESS_PROFILE_SCHEMA_MIGRATION,
  BUSINESS_PROFILE_STATUSES,
  BUSINESS_PROFILE_DRAFT_SOURCES,
  BUSINESS_PROFILE_DRAFT_LABEL,
  BUSINESS_PROFILE_APPROVED_LABEL,
  isBusinessProfileActive,
  type BusinessProfileStatus,
  type BusinessProfileDraftSource,
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
  buildDeterministicProfileContent,
  type BusinessProfileDraftGeneratorMode,
  type BusinessProfileDraftGeneratorOptions,
  type BuildDeterministicProfileOptions,
} from "@/lib/growth/business-profile/business-profile-draft-generator"

export {
  capBusinessProfileWebsiteContext,
  sanitizeBusinessProfileWebsiteText,
  BUSINESS_PROFILE_WEBSITE_CONTEXT_MAX_CHARS,
} from "@/lib/growth/business-profile/business-profile-website-context-utils"

export {
  businessProfileAiDraftModelSchema,
  type BusinessProfileAiDraftModel,
} from "@/lib/growth/business-profile/business-profile-ai-draft-schema"

export { mapAiModelToBusinessProfileContent } from "@/lib/growth/business-profile/business-profile-ai-draft-mapper"

export {
  GROWTH_BUSINESS_PROFILE_API_PATH,
  GROWTH_BUSINESS_PROFILE_DRAFT_LABEL,
  GROWTH_BUSINESS_PROFILE_DRAFTING_MESSAGE,
  GROWTH_BUSINESS_PROFILE_APPROVE_LABEL,
  GROWTH_BUSINESS_PROFILE_REJECT_LABEL,
  GROWTH_BUSINESS_PROFILE_UPDATE_LABEL,
  GROWTH_BUSINESS_PROFILE_SECTION_TITLE,
  type GrowthBusinessProfileApiResponse,
  type GrowthBusinessProfileDraftRequest,
  type GrowthBusinessProfileUpdateRequest,
} from "@/lib/growth/business-profile/business-profile-api-contract"
