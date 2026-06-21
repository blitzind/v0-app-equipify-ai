/** GS-AI-PLAYBOOK-3A — Account intelligence types (client-safe). */

export const GROWTH_ACCOUNT_INTELLIGENCE_QA_MARKER =
  "growth-account-intelligence-gs-ai-playbook-3a-v1" as const

export type GrowthAccountIntelligenceCertainty = "verified" | "likely" | "unknown"

export type GrowthAccountIntelligenceSourceType =
  | "crm_metadata"
  | "research"
  | "website_crawl"
  | "discovery"
  | "apollo"
  | "public_indicator"

export type GrowthAccountIntelligenceSignalCategory =
  | "operational"
  | "growth"
  | "compliance"
  | "technology"
  | "customer"
  | "differentiation"
  | "summary"
  | "location"
  | "services"
  | "products"
  | "equipment"
  | "financial"
  | "website"

export type GrowthAccountIntelligenceNormalizedSignal = {
  id: string
  category: GrowthAccountIntelligenceSignalCategory
  claim: string
  source: GrowthAccountIntelligenceSourceType
  sourcePrecedence: number
  confidence: number
  certainty: GrowthAccountIntelligenceCertainty
  freshness: string | null
  fieldKey: string | null
}

export type GrowthAccountIntelligenceModel = {
  companySummary: string[]
  services: string[]
  products: string[]
  industriesServed: string[]
  locations: string[]
  employeeEstimate: string | null
  growthIndicators: string[]
  hiringIndicators: string[]
  technologyStack: string[]
  equipmentIndicators: string[]
  complianceIndicators: string[]
  operationalSignals: string[]
  financialSignals: string[]
  customerSignals: string[]
  differentiationSignals: string[]
  competitiveSignals: string[]
  websiteHighlights: string[]
  recentChanges: string[]
  confidence: number
  freshness: string | null
}

export type GrowthAccountIntelligencePromptSections = {
  verifiedCompanySummary: string
  verifiedOperationalSignals: string
  verifiedGrowthSignals: string
  verifiedTechnologySignals: string
  verifiedCustomerSignals: string
  verifiedDifferentiators: string
}

export type GrowthAccountIntelligenceDiagnostics = {
  signalCount: number
  confidence: number
  freshness: string | null
  sourceBreakdown: Record<GrowthAccountIntelligenceSourceType, number>
  verifiedSummary: string
  topSignals: string[]
  missingSignals: string[]
}

export type GrowthAccountIntelligenceSnapshotFinding = {
  category: string
  key: string
  value: string
  source: string
  confidence: number
  verificationStatus?: string | null
  observedAt?: string | null
}

export type GrowthAccountIntelligenceInput = {
  companyName?: string | null
  companySummary?: string | null
  websiteSummary?: string | null
  researchFindings?: string[]
  outreachAngles?: string[]
  equipmentServiceIndicators?: string[]
  enrichmentFindings?: string[]
  websiteText?: string | null
  websiteFindings?: string[]
  websiteSignals?: string[]
  discoveryFindings?: string[]
  apolloFindings?: string[]
  publicIndicators?: string[]
  verifiedFacts?: string[]
  intelligenceSnapshots?: GrowthAccountIntelligenceSnapshotFinding[]
  crmMetadata?: Record<string, string | string[] | null | undefined>
  leadMetadata?: Record<string, unknown>
  companySize?: string | null
  decisionMakerTitle?: string | null
  naics?: string | string[] | null
  sic?: string | string[] | null
  researchConfidence?: number | null
  observedAt?: string | null
  hiringSignals?: string[]
  leadSignals?: string[]
  researchSignals?: string[]
}

export type GrowthAccountIntelligenceContext = {
  model: GrowthAccountIntelligenceModel
  diagnostics: GrowthAccountIntelligenceDiagnostics
  promptSections: GrowthAccountIntelligencePromptSections
}
