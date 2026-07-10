/** GE-AIOS-22 — Evidence-driven company qualification types (client-safe). */

export const GROWTH_COMPANY_EVIDENCE_22_QA_MARKER = "ge-aios-22-company-evidence-v1" as const

export const GROWTH_COMPANY_EVIDENCE_PHASE = "GE-AIOS-22" as const

export type GrowthCompanyEvidenceField<T = string> = {
  value: T
  evidence: string
  confidence: number
  sourceUrl: string | null
}

export type GrowthCompanyEvidenceListField = {
  values: string[]
  evidence: string[]
  confidence: number
  sourceUrls: string[]
}

export type GrowthCompanyEvidenceProfile = {
  companyDescription: GrowthCompanyEvidenceField | null
  industriesServed: GrowthCompanyEvidenceListField | null
  primaryProducts: GrowthCompanyEvidenceListField | null
  primaryServices: GrowthCompanyEvidenceListField | null
  targetCustomers: GrowthCompanyEvidenceListField | null
  businessModel: GrowthCompanyEvidenceField | null
  geographicMarkets: GrowthCompanyEvidenceListField | null
  estimatedCompanySize: GrowthCompanyEvidenceField | null
  differentiators: GrowthCompanyEvidenceListField | null
  technologySignals: GrowthCompanyEvidenceListField | null
  hiringSignals: GrowthCompanyEvidenceListField | null
}

export type GrowthCompanyEvidenceQualityScores = {
  identityConfidence: number
  websiteConfidence: number
  industryConfidence: number
  offeringConfidence: number
  marketConfidence: number
  overallEvidenceConfidence: number
}

export type GrowthCompanyEvidenceCrawlState = {
  pagesPlanned: number
  pagesCrawled: number
  pagesSkipped: number
  stoppedEarly: boolean
  stopReason: string | null
  websiteCoverage: string[]
  missingInformation: string[]
}

export type GrowthCompanyEvidenceMissionMatchLabel =
  | "strong_manufacturing_match"
  | "industrial_b2b"
  | "medical_device_supplier"
  | "outside_geographic_focus"
  | "consumer_retail"
  | "construction"
  | "software_vendor"
  | "profile_aligned"
  | "profile_mismatch"
  | "insufficient_evidence"

export type GrowthCompanyEvidenceMissionComparison = {
  labels: GrowthCompanyEvidenceMissionMatchLabel[]
  explanations: string[]
  profileAlignmentScore: number
  evidenceBacked: boolean
}

export type GrowthCompanyEvidenceQualificationDecision = "accepted" | "review" | "rejected" | "unknown"

export type GrowthCompanyEvidenceQualificationExplanation = {
  decision: GrowthCompanyEvidenceQualificationDecision
  headline: string
  reasons: string[]
  confidencePercent: number
  evidenceSources: string[]
  missingEvidence: string[]
}

export type GrowthCompanyEvidenceBundle = {
  qaMarker: typeof GROWTH_COMPANY_EVIDENCE_22_QA_MARKER
  collectedAt: string
  websiteUrl: string | null
  profile: GrowthCompanyEvidenceProfile
  qualityScores: GrowthCompanyEvidenceQualityScores
  crawlState: GrowthCompanyEvidenceCrawlState
  missionComparison: GrowthCompanyEvidenceMissionComparison | null
  qualificationExplanation: GrowthCompanyEvidenceQualificationExplanation | null
  evidenceSources: string[]
  cacheKey: string | null
}
