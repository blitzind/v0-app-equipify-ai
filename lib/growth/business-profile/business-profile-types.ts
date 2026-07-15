/** GE-AIOS-BUSINESS-PROFILE-1A/1B / GE-AIOS-19C-2E — AI OS Business Profile types (client-safe). */

import type { BusinessStrategyContent } from "@/lib/growth/training/growth-business-strategy-types"
import type {
  EquipifyCanonicalSellerKnowledge,
  EquipifyMasterKnowledgeIngestionMeta,
} from "@/lib/growth/business-profile/equipify-master-knowledge-types"

export const GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER = "ge-aios-business-profile-1a-v1" as const
export const GROWTH_AIOS_BUSINESS_PROFILE_1B_QA_MARKER = "ge-aios-business-profile-1b-v1" as const

export const GROWTH_AIOS_BUSINESS_PROFILE_SCHEMA_MIGRATION =
  "20271001270000_growth_organization_business_profile_ge_aios_business_profile_1a.sql" as const

export const BUSINESS_PROFILE_STATUSES = ["draft", "approved", "rejected"] as const
export type BusinessProfileStatus = (typeof BUSINESS_PROFILE_STATUSES)[number]

export const BUSINESS_PROFILE_DRAFT_LABEL =
  "Draft — review before Ava uses this." as const

export const BUSINESS_PROFILE_APPROVED_LABEL =
  "Approved — Ava can use this to guide lead discovery and recommendations." as const

export const BUSINESS_PROFILE_DRAFT_SOURCES = ["deterministic", "ai_assisted", "ai_fallback"] as const
export type BusinessProfileDraftSource = (typeof BUSINESS_PROFILE_DRAFT_SOURCES)[number]

export type BusinessProfileInput = {
  companyName: string
  website: string
  notes?: string | null
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

export type BusinessProfileSupportedServiceVerticalRef = {
  id: string
  label: string
}

export type BusinessProfileIdealCustomersSection = {
  targetIndustries: string[]
  /** GE-AIOS-SUPPORTED-SERVICE-VERTICALS-PROJECTION-1B — optional explicit vertical refs (profile_json SoT). */
  supportedServiceVerticals?: BusinessProfileSupportedServiceVerticalRef[]
  companySizeRanges: string[]
  geography: string[]
  buyerPersonas: string[]
  disqualifiers: string[]
  /** GE-AIOS-LIVE-1B — Prospect-search include filters (not admission shortcuts). */
  preferredNaicsCodes?: string[]
  excludedNaicsCodes?: string[]
  preferredSicCodes?: string[]
  excludedSicCodes?: string[]
  industryCodeNotes?: string | null
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

/** GE-AIOS-AUTONOMOUS-PORTFOLIO-MANAGER-1A — operator portfolio targets (canonical owner: Business Profile). */
export type BusinessProfilePortfolioManagementSection = {
  targetActiveCompanies: number
  minimumHealthyCompanies: number
  replenishBatchSize: number
  maximumDailyDiscovery: number
  maximumConcurrentResearch: number
  maximumQueuedAdmissions: number
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
  /** GE-AIOS-19C-2E — operator-authored philosophy (optional until taught). */
  businessStrategy?: BusinessStrategyContent
  /** GE-AIOS-EQUIPIFY-MASTER-KNOWLEDGE-1A — enriched canonical seller knowledge (profile_json SoT). */
  canonicalSellerKnowledge?: EquipifyCanonicalSellerKnowledge
  /** GE-AIOS-EQUIPIFY-MASTER-KNOWLEDGE-1A — MCD ingestion metadata (ingestion-only, not runtime SoT). */
  masterKnowledgeIngestion?: EquipifyMasterKnowledgeIngestionMeta
  /** GE-AIOS-AUTONOMOUS-PORTFOLIO-MANAGER-1A — autonomous portfolio targets for Ava. */
  portfolioManagement?: BusinessProfilePortfolioManagementSection
  confidence: BusinessProfileConfidenceSection
  draftSource?: BusinessProfileDraftSource
  websiteContextSummary?: string | null
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
