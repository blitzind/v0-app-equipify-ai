/** GE-AIOS-BUSINESS-PROFILE-1A — AI OS Business Profile types (client-safe). */

export const GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER = "ge-aios-business-profile-1a-v1" as const

export const GROWTH_AIOS_BUSINESS_PROFILE_SCHEMA_MIGRATION =
  "20271001270000_growth_organization_business_profile_ge_aios_business_profile_1a.sql" as const

export const BUSINESS_PROFILE_STATUSES = ["draft", "approved", "rejected"] as const
export type BusinessProfileStatus = (typeof BUSINESS_PROFILE_STATUSES)[number]

export const BUSINESS_PROFILE_DRAFT_LABEL =
  "Draft — review before Ava uses this." as const

export const BUSINESS_PROFILE_APPROVED_LABEL =
  "Approved — Ava can use this to guide lead discovery and recommendations." as const

export type BusinessProfileInput = {
  companyName: string
  website: string
  whatTheySell?: string | null
  whoTheySellTo?: string | null
  geography?: string | null
  averageDealSize?: string | null
}

export type BusinessProfileCompanySection = {
  companyName: string
  website: string
  shortDescription: string
  productsServices: string[]
  businessModel: string
  primaryValueProposition: string
}

export type BusinessProfileIdealCustomersSection = {
  targetIndustries: string[]
  companySizeRanges: string[]
  geography: string[]
  buyerPersonas: string[]
  disqualifiers: string[]
}

export type BusinessProfileProblemsSection = {
  painPoints: string[]
  buyingTriggers: string[]
  competitorsAlternatives: string[]
  keywords: string[]
  negativeKeywords: string[]
}

export type BusinessProfileSalesMarketingSection = {
  averageDealSize: string | null
  salesCycleEstimate: string | null
  messagingAngles: string[]
  qualificationCriteria: string[]
}

export type BusinessProfileConfidenceSection = {
  score: number
  assumptions: string[]
  missingInformation: string[]
}

export type BusinessProfileDraftContent = {
  company: BusinessProfileCompanySection
  idealCustomers: BusinessProfileIdealCustomersSection
  problemsAndTriggers: BusinessProfileProblemsSection
  salesAndMarketing: BusinessProfileSalesMarketingSection
  confidence: BusinessProfileConfidenceSection
}

export type BusinessProfileDraft = {
  status: "draft"
  isActive: false
  input: BusinessProfileInput
  profile: BusinessProfileDraftContent
  label: typeof BUSINESS_PROFILE_DRAFT_LABEL
}

export type ApprovedBusinessProfile = {
  status: "approved"
  isActive: true
  input: BusinessProfileInput
  profile: BusinessProfileDraftContent
  label: typeof BUSINESS_PROFILE_APPROVED_LABEL
  approvedAt: string
  approvedBy: string | null
}

export type RejectedBusinessProfile = {
  status: "rejected"
  isActive: false
  input: BusinessProfileInput
  profile: BusinessProfileDraftContent
  label: typeof BUSINESS_PROFILE_DRAFT_LABEL
  rejectedAt: string
}

export type BusinessProfileRecord = {
  id: string
  organizationId: string
  status: BusinessProfileStatus
  isActive: boolean
  companyName: string
  website: string
  input: BusinessProfileInput
  profile: BusinessProfileDraftContent
  label: string
  createdBy: string | null
  approvedBy: string | null
  approvedAt: string | null
  rejectedAt: string | null
  createdAt: string
  updatedAt: string
}

export function isBusinessProfileActive(record: Pick<BusinessProfileRecord, "status">): boolean {
  return record.status === "approved"
}
