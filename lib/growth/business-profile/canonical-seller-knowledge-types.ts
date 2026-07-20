/**
 * GE-AIOS-FIRST-CUSTOMER-SALES-READINESS-1A — Organization-agnostic canonical seller knowledge types.
 * Lives in profile_json.canonicalSellerKnowledge (Business Profile remains SoT).
 */

export const GROWTH_AIOS_CANONICAL_SELLER_KNOWLEDGE_1A_QA_MARKER =
  "ge-aios-first-customer-sales-readiness-1a-v1" as const

export const CANONICAL_SELLER_KNOWLEDGE_SCHEMA_VERSION = "canonical-seller-knowledge-v1" as const

export const CANONICAL_SELLER_KNOWLEDGE_INGESTION_SOURCES = [
  "approved_business_profile",
  "website",
  "pricing_page",
  "supported_service_vertical_registry",
  "master_knowledge_seed",
  "organization_memory",
  "approved_documentation",
  "uploaded_training_document",
  "business_intelligence",
  "knowledge_center",
] as const

export type CanonicalSellerKnowledgeIngestionSource =
  (typeof CANONICAL_SELLER_KNOWLEDGE_INGESTION_SOURCES)[number]

export type CanonicalSellerKnowledgeIngestionRecord = {
  source: CanonicalSellerKnowledgeIngestionSource
  sourceDocumentId?: string | null
  ingestionVersion: string
  contentFingerprint: string
  ingestedAt: string
  appliedAt?: string | null
  mergedSections: string[]
  /** Ingestion metadata only — never runtime SoT. */
  isRuntimeSourceOfTruth: false
}

export type SellerCapabilityKnowledge = {
  feature: string
  purpose: string
  businessProblemSolved: string
  businessOutcome: string
  whoBenefits: string[]
  whenToIntroduce: string
  whenNotToIntroduce: string
  dependencies?: string[]
  implementationNotes?: string
  relatedCapabilities?: string[]
  availability: "current" | "future"
}

export type SellerIndustryKnowledge = {
  industry: string
  commonWorkflows: string[]
  operationalTerminology: string[]
  typicalEquipment: string[]
  commonKpis: string[]
  typicalOrgStructure: string[]
  seasonality?: string
  operationalChallenges: string[]
  serviceChallenges: string[]
  dispatcherChallenges: string[]
  technicianChallenges: string[]
  ownerPriorities: string[]
  buyingTriggers: string[]
  operationalRisks: string[]
  typicalObjections: string[]
  discoveryOpportunities: string[]
  conversationStarters: string[]
}

export type SellerBuyerPersonaKnowledge = {
  persona: string
  responsibilities: string[]
  successMetrics: string[]
  painPoints: string[]
  buyingMotivations: string[]
  objections: string[]
  preferredLanguage: string[]
  conversationStyle: string
  desiredBusinessOutcomes: string[]
}

export type SellerCompetitorKnowledge = {
  name: string
  positioning: string
  typicalCustomer: string
  strengths: string[]
  weaknesses: string[]
  migrationConcerns: string[]
  whenSellerWins: string[]
  whenSellerDoesNotWin: string[]
  professionalDiscussion: string
}

export type SellerProofKnowledge = {
  title: string
  industry?: string
  operationalImprovement: string
  businessOutcome: string
  implementationTimeline?: string
  beforeAfter?: string
  evidenceNote: string
}

export type SellerCommercialKnowledge = {
  packagingPhilosophy: string
  pricingPhilosophy: string
  expansionStrategy: string
  implementationExpectations: string
  onboardingApproach: string
  securityConversation: string
  itConversation: string
  procurementExpectations: string
  budgetConversation: string
  whenNotToDiscussPricing: string
}

export type SellerDiscoveryMethodology = {
  principles: string[]
  diagnosticOrder: string[]
}

export type SellerBuyingPsychologyInsight = {
  persona: string
  whyTheyBuy: string
  messagingInfluence: string
}

export type SellerCompanyKnowledge = {
  mission: string
  vision: string
  values: string[]
  salesPhilosophy: string[]
  businessPhilosophy: string[]
  targetCustomer: string
  poorFitCustomer: string
  differentiators: string[]
  uniqueStrengths: string[]
  limitations: string[]
  whenNotToRecommend: string[]
  implementationPhilosophy: string
  businessOutcomes: string[]
  operationalImprovements: string[]
  currentRoadmapNote: string
  futureRoadmapNote: string
}

/** Organization-agnostic canonical seller knowledge (profile_json SoT). */
export type CanonicalSellerKnowledge = {
  version: string
  company: SellerCompanyKnowledge
  products: {
    platformName: string
    modules: SellerCapabilityKnowledge[]
  }
  industries: SellerIndustryKnowledge[]
  personas: SellerBuyerPersonaKnowledge[]
  competitors: SellerCompetitorKnowledge[]
  proof: SellerProofKnowledge[]
  commercial: SellerCommercialKnowledge
  discovery: SellerDiscoveryMethodology
  buyingPsychology: SellerBuyingPsychologyInsight[]
  /** Extended sales principles beyond company.salesPhilosophy. */
  salesPhilosophyPrinciples: string[]
}

export type CanonicalSellerKnowledgeSeedProvider = {
  organizationId: string
  buildSeed: () => CanonicalSellerKnowledge
  seedVersion: string
}
