/** GE-AIOS-EQUIPIFY-MASTER-KNOWLEDGE-1A — Canonical seller knowledge types (client-safe, lives in profile_json). */

export const GROWTH_AIOS_EQUIPIFY_MASTER_KNOWLEDGE_1A_QA_MARKER =
  "ge-aios-equipify-master-knowledge-1a-v1" as const

export const EQUIPIFY_MASTER_KNOWLEDGE_VERSION = "equipify-master-knowledge-v1" as const

export const GROWTH_AIOS_EQUIPIFY_MASTER_KNOWLEDGE_1B_QA_MARKER =
  "ge-aios-equipify-master-knowledge-1b-production-apply-v1" as const

export const EQUIPIFY_MASTER_CONTEXT_SOURCE_DOCUMENT_ID =
  "docs/MASTER_CONTEXT_DOCUMENT.md" as const

export type EquipifyMasterKnowledgeIngestionMeta = {
  source: "master_context_document"
  /** GE-AIOS-MASTER-KNOWLEDGE-1B — stable document identifier for ingestion audit. */
  sourceDocumentId?: string
  /** Canonical seed + ingestion pipeline version. */
  ingestionVersion?: string
  /** Stable hash of MCD hints + canonical version used for idempotency. */
  contentFingerprint?: string
  ingestedAt: string
  /** GE-AIOS-MASTER-KNOWLEDGE-1B — when enrichment was applied to profile_json. */
  appliedAt?: string
  sourceMarker: string
  /** Master Context is ingestion-only — never runtime SoT. */
  isRuntimeSourceOfTruth: false
  mergedSections: string[]
}

export type EquipifyCapabilityKnowledge = {
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

export type EquipifyIndustryKnowledge = {
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

export type EquipifyBuyerPersonaKnowledge = {
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

export type EquipifyCompetitorKnowledge = {
  name: string
  positioning: string
  typicalCustomer: string
  strengths: string[]
  weaknesses: string[]
  migrationConcerns: string[]
  whenEquipifyWins: string[]
  whenEquipifyDoesNotWin: string[]
  professionalDiscussion: string
}

export type EquipifyProofKnowledge = {
  title: string
  industry?: string
  operationalImprovement: string
  businessOutcome: string
  implementationTimeline?: string
  beforeAfter?: string
  evidenceNote: string
}

export type EquipifyCommercialKnowledge = {
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

export type EquipifyDiscoveryMethodology = {
  principles: string[]
  diagnosticOrder: string[]
}

export type EquipifyBuyingPsychologyInsight = {
  persona: string
  whyTheyBuy: string
  messagingInfluence: string
}

export type EquipifyCompanyKnowledge = {
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

export type EquipifyCanonicalSellerKnowledge = {
  version: typeof EQUIPIFY_MASTER_KNOWLEDGE_VERSION
  company: EquipifyCompanyKnowledge
  products: {
    platformName: string
    modules: EquipifyCapabilityKnowledge[]
  }
  industries: EquipifyIndustryKnowledge[]
  personas: EquipifyBuyerPersonaKnowledge[]
  competitors: EquipifyCompetitorKnowledge[]
  proof: EquipifyProofKnowledge[]
  commercial: EquipifyCommercialKnowledge
  discovery: EquipifyDiscoveryMethodology
  buyingPsychology: EquipifyBuyingPsychologyInsight[]
  equipifySalesPhilosophy: string[]
}
