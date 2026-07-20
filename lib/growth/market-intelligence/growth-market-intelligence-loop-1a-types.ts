/** GE-AIOS-MARKET-INTELLIGENCE-LOOP-1A — Market Intelligence Loop types (client-safe). */

import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import type { OrganizationalKnowledgeItem } from "@/lib/growth/memory/knowledge/organization-knowledge-types"

export const GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER =
  "ge-aios-market-intelligence-loop-1a-v1" as const

export const GROWTH_MARKET_INTELLIGENCE_LOOP_MEMORY_PREFERENCE_KEY =
  "ge-aios-market-intelligence-loop-1a" as const

export const GROWTH_MARKET_INTELLIGENCE_MIN_CONFIDENCE_PERCENT = 75 as const
export const GROWTH_MARKET_INTELLIGENCE_MIN_SEGMENT_RESEARCHED = 5 as const
export const GROWTH_MARKET_INTELLIGENCE_MIN_SUPPORTING_EVENTS = 3 as const
export const GROWTH_MARKET_INTELLIGENCE_PROPOSAL_COOLDOWN_DAYS = 14 as const

export const MARKET_INTELLIGENCE_SEGMENT_DIMENSIONS = [
  "industry",
  "naics",
  "sic",
  "company_size",
  "persona",
  "technology",
  "service_type",
  "region",
] as const

export type MarketIntelligenceSegmentDimension = (typeof MARKET_INTELLIGENCE_SEGMENT_DIMENSIONS)[number]

export const MARKET_INTELLIGENCE_RECOMMENDATION_KINDS = [
  "add_industry",
  "remove_industry",
  "increase_priority",
  "decrease_priority",
  "add_persona",
  "remove_persona",
  "expand_geography",
  "reduce_geography",
  "add_technology",
  "adjust_company_size",
  "update_messaging",
  "update_objections",
  "update_competitors",
] as const

export type MarketIntelligenceRecommendationKind = (typeof MARKET_INTELLIGENCE_RECOMMENDATION_KINDS)[number]

export type MarketIntelligenceEvidenceRef = {
  source:
    | "business_profile"
    | "evidence_engine"
    | "business_intelligence"
    | "institutional_learning"
    | "sales_outcome"
    | "lead_admission"
    | "qualification"
    | "meeting"
    | "opportunity"
    | "customer_health"
    | "reply_intelligence"
    | "memory_event"
  label: string
  referenceId: string | null
  observedAt: string | null
}

export type MarketIntelligenceSegmentMetrics = {
  dimension: MarketIntelligenceSegmentDimension
  segmentKey: string
  segmentLabel: string
  researched: number
  admitted: number
  qualified: number
  meetings: number
  approvals: number
  opportunities: number
  won: number
  lost: number
  retained: number
  expansion: number
  churn: number
  lifetimeValue: number | null
  researchRate: number | null
  admissionRate: number | null
  qualificationRate: number | null
  meetingRate: number | null
  approvalRate: number | null
  opportunityRate: number | null
  winRate: number | null
  retentionRate: number | null
  expansionRate: number | null
}

export type MarketIntelligenceSnapshotDimension = {
  values: string[]
  source: MarketIntelligenceEvidenceRef["source"]
  confidence: number | null
}

export type MarketIntelligenceSnapshot = {
  qaMarker: typeof GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER
  organizationId: string
  capturedAt: string
  industries: MarketIntelligenceSnapshotDimension
  personas: MarketIntelligenceSnapshotDimension
  companySizes: MarketIntelligenceSnapshotDimension
  geographies: MarketIntelligenceSnapshotDimension
  technologies: MarketIntelligenceSnapshotDimension
  painPoints: MarketIntelligenceSnapshotDimension
  messaging: MarketIntelligenceSnapshotDimension
  pricing: MarketIntelligenceSnapshotDimension
  objections: MarketIntelligenceSnapshotDimension
  competitors: MarketIntelligenceSnapshotDimension
  retention: MarketIntelligenceSnapshotDimension
  expansion: MarketIntelligenceSnapshotDimension
  segmentPerformance: MarketIntelligenceSegmentMetrics[]
  validatedLearnings: OrganizationalKnowledgeItem[]
  supportingEvidence: MarketIntelligenceEvidenceRef[]
}

export type MarketIntelligenceConfidenceAssessment = {
  confidencePercent: number
  sampleSize: number
  supportingEvidence: MarketIntelligenceEvidenceRef[]
  contradictingEvidence: MarketIntelligenceEvidenceRef[]
  passesThreshold: boolean
}

export type MarketIntelligenceRecommendation = {
  id: string
  kind: MarketIntelligenceRecommendationKind
  fieldPath: string
  before: string | string[]
  after: string | string[]
  confidence: MarketIntelligenceConfidenceAssessment
  reason: string
  supportingEvidence: MarketIntelligenceEvidenceRef[]
  businessImpactEstimate: string | null
  affectedSearchVolumeEstimate: number | null
  expectedPortfolioImpactPercent: number | null
  explainabilityLines: string[]
}

export type MarketIntelligenceProposalStatus =
  | "none"
  | "pending_review"
  | "draft_created"
  | "accepted"
  | "superseded"

export type MarketIntelligenceProposal = {
  qaMarker: typeof GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER
  proposalId: string
  organizationId: string
  createdAt: string
  status: MarketIntelligenceProposalStatus
  recommendations: MarketIntelligenceRecommendation[]
  profileDraftId: string | null
  beforeProfileFingerprint: string | null
  afterProfileFingerprint: string | null
  summary: string
  explainabilityLines: string[]
}

export type MarketIntelligenceLoopMemory = {
  qaMarker: typeof GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER
  lastEvaluatedAt: string | null
  lastProposalId: string | null
  lastProposalAt: string | null
  lastAcceptedProposalId: string | null
  lastAcceptedAt: string | null
  pendingProposalId: string | null
  pendingProfileDraftId: string | null
}

export type MarketIntelligenceOperatorProjection = {
  qaMarker: typeof GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER
  currentStrategySummary: string
  suggestedImprovements: MarketIntelligenceRecommendation[]
  lastAcceptedImprovementSummary: string | null
  lastAcceptedAt: string | null
  pendingReview: boolean
  pendingProposalSummary: string | null
  pendingProposalConfidencePercent: number | null
  profileDraftHref: string
  emptyMessage: string | null
}

export type BuildMarketIntelligenceSnapshotInput = {
  organizationId: string
  generatedAt: string
  approvedProfile: BusinessProfileDraftContent | null
  validatedLearnings: OrganizationalKnowledgeItem[]
  biIndustries?: string[] | null
  biPersonas?: string[] | null
  biGeographies?: string[] | null
  biPainPoints?: string[] | null
  biMessaging?: string[] | null
  biPricing?: string[] | null
  biObjections?: string[] | null
  biCompetitors?: string[] | null
  segmentMetrics: MarketIntelligenceSegmentMetrics[]
  evidenceRefs: MarketIntelligenceEvidenceRef[]
}

export type MarketIntelligenceLoopEvaluation = {
  qaMarker: typeof GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER
  snapshot: MarketIntelligenceSnapshot
  recommendations: MarketIntelligenceRecommendation[]
  proposal: MarketIntelligenceProposal | null
  shouldCreateProposal: boolean
  skipReason: string | null
}
