/**
 * Fuzor OS — Company Intelligence platform package entry.
 *
 * Conceptual ownership: Fuzor OS.
 * Physical implementation currently lives under
 * lib/growth/company-intelligence/gpt-business-understanding/
 * (Growth is a consumer; packaging move deferred until consumers migrate).
 *
 * Prefer importing from @/lib/fuzor/company-intelligence for new platform callers.
 * Prefer Growth lead adapter for Equipify / Growth Engine compatibility.
 */

export {
  FUZOR_COMPANY_INTELLIGENCE_2A_QA_MARKER,
  FUZOR_COMPANY_INTELLIGENCE_2A_MIGRATION,
  FUZOR_COMPANY_INTELLIGENCE_OWNER_ORG_MIGRATION,
  FUZOR_COMPANY_INTELLIGENCE_2A_GENERATION_MODE,
  FUZOR_COMPANY_INTELLIGENCE_PLATFORM_VERSION,
  FUZOR_PLATFORM_LIFT_1A_QA_MARKER,
  FUZOR_CI_BRIDGE_PROVIDER_SUMMARY,
  type CompanyIntelligenceForAiEmployee,
  type EnsureCompanyIntelligenceResult,
  type FuzorCompanyIntelligenceVersionRecord,
  type FuzorCompanyIntelligenceEvidenceRefs,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-2a-types"

export {
  ensureCompanyIntelligence,
  loadCompanyIntelligence,
  consumeCompanyIntelligenceForAiEmployee,
  companyIntelligenceUnderstandingFingerprint,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-platform"

export {
  ensureCompanyIntelligenceForGrowthLead,
  loadCompanyIntelligenceForGrowthLead,
  consumeCompanyIntelligenceForGrowthLead,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-growth-lead-adapter"

export {
  isFuzorCompanyIntelligenceVersionsSchemaReady,
  fuzorCompanyIntelligenceSchemaNotReadyMessage,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-repository"
