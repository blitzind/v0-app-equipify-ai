/**
 * GE-AIOS-RELATIONSHIP-STRATEGY-2A — Relationship assessment projections (client-safe).
 * Computed at prep time only — never persisted separately.
 */

import type { GrowthLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-types"
import type { RevenueStrategyRecommendation } from "@/lib/growth/aios/growth/growth-outreach-revenue-strategy-intelligence"

export const GROWTH_AIOS_RELATIONSHIP_STRATEGY_2A_QA_MARKER =
  "ge-aios-relationship-strategy-2a-v1" as const

export type RelationshipGoalKey =
  | "earn_first_reply"
  | "build_credibility"
  | "validate_operational_pain"
  | "expand_committee"
  | "identify_champion"
  | "recover_trust"
  | "support_opportunity"
  | "prepare_executive_conversation"
  | "protect_relationship"
  | "walk_away"

export type TrustBudgetLevel = "building" | "maintaining" | "consuming" | "damaging" | "depleted"

export type RelationshipConfidenceLevel = "very_high" | "high" | "moderate" | "low" | "unknown"

export type RelationshipMomentumTrend = "accelerating" | "steady" | "stalling" | "reversing"

export type RelationshipDirection = "warming" | "stable" | "cooling" | "dormant" | "unknown"

export type RelationshipProtectionAction =
  | "pause"
  | "wait"
  | "delay"
  | "recover_trust"
  | "protect_credibility"
  | "wrong_timing"
  | "wrong_stakeholder"
  | "wrong_icp"
  | "walk_away"
  | "none"

export type RelationshipImprovementOutlook = "improve" | "neutral" | "weaken"

export type SafeRecallSource =
  | "objection"
  | "commitment"
  | "reply"
  | "meeting"
  | "preference"
  | "interaction"

export type GrowthOutreachSafeRecallItem = {
  topic: string
  naturalPhrase: string
  source: SafeRecallSource
  confidence: string
  freshnessWeight: number
}

export type GrowthOutreachRelationshipStorySection = {
  key: string
  label: string
  lines: string[]
}

export type GrowthOutreachRelationshipStory = {
  summary: string
  sections: GrowthOutreachRelationshipStorySection[]
  essentials: string[]
  recommendedDirection: string
}

export type GrowthOutreachRelationshipGoal = {
  current: RelationshipGoalKey
  label: string
  rationale: string
  successCriteria: string
  progress: number
  completed: boolean
  nextGoal: RelationshipGoalKey | null
}

export type GrowthOutreachRelationshipMomentum = {
  score: number
  trend: RelationshipMomentumTrend
  signals: string[]
}

export type GrowthOutreachTrustBudget = {
  level: TrustBudgetLevel
  score: number
  rationale: string[]
}

export type GrowthOutreachRelationshipConfidence = {
  level: RelationshipConfidenceLevel
  score: number
  rationale: string
}

export type GrowthOutreachRelationshipImprovementLikelihood = {
  ifProceed: RelationshipImprovementOutlook
  ifDelay: RelationshipImprovementOutlook
  rationale: string[]
}

export type GrowthOutreachRelationshipPrediction = {
  likelyNextState: RelationshipDirection
  improveLikelihood: number
  stallLikelihood: number
  weakenLikelihood: number
}

export type GrowthOutreachStrategyEvolution = {
  refreshReasons: string[]
  previousRecommendation: RevenueStrategyRecommendation | string | null
  recommendationChanged: boolean
  evolutionSummary: string[]
  confidenceDelta: number | null
  whyChanged: string[]
}

export type GrowthOutreachRelationshipProtection = {
  action: RelationshipProtectionAction
  rationale: string[]
  active: boolean
}

export type GrowthOutreachInstitutionalAdviceSnippet = {
  pattern: string
  source: string
  confidence?: number
  sampleSize?: number
  freshnessDays?: number
  applicability?: string
}

export type GrowthOutreachRelationshipAssessment = {
  qaMarker: typeof GROWTH_AIOS_RELATIONSHIP_STRATEGY_2A_QA_MARKER
  available: boolean
  relationshipStory: GrowthOutreachRelationshipStory
  relationshipGoal: GrowthOutreachRelationshipGoal
  relationshipDirection: RelationshipDirection
  relationshipMomentum: GrowthOutreachRelationshipMomentum
  trustBudget: GrowthOutreachTrustBudget
  relationshipConfidence: GrowthOutreachRelationshipConfidence
  relationshipImprovementLikelihood: GrowthOutreachRelationshipImprovementLikelihood
  relationshipPrediction: GrowthOutreachRelationshipPrediction
  strategyEvolution: GrowthOutreachStrategyEvolution
  safeRecall: GrowthOutreachSafeRecallItem[]
  relationshipProtection: GrowthOutreachRelationshipProtection
  institutionalAdvice: GrowthOutreachInstitutionalAdviceSnippet[]
  answeredThemes: string[]
  memoryFreshnessWeight: number
  previousStrategyConfidence: number | null
}

export type RelationshipAssessmentLeadSignals = {
  relationshipStrengthScore?: number | null
  relationshipStrengthTier?: string | null
  relationshipTrend?: string | null
  sequenceFatigueRisk?: string | null
  leadStatus?: string | null
  hasMeetingScheduled?: boolean
  isCustomer?: boolean
  isSuppressed?: boolean
}

export type RelationshipAssessmentContextSignals = {
  priorTouchCount: number
  priorReplyCount: number
  priorOutboundSubjects: string[]
  objectionSummaries: string[]
  priorReplySummaries: string[]
  sequenceHistorySummaries: string[]
  memoryOpenLoopSummaries: string[]
  buyingIntent?: string | null
  competitorPressure?: string | null
}

export type BuildRelationshipAssessmentInput = {
  leadId: string
  companyName: string
  preparedAt: string
  memory: GrowthLeadMemoryInfluenceContext | null | undefined
  context: RelationshipAssessmentContextSignals
  lead: RelationshipAssessmentLeadSignals
  refreshReasons?: string[]
  previousRecommendation?: RevenueStrategyRecommendation | string | null
  previousConfidence?: number | null
  currentConfidence?: number | null
  institutionalAdvice?: GrowthOutreachInstitutionalAdviceSnippet[]
  committeeMemberCount?: number
  singleThreadRisk?: boolean
}

export const RELATIONSHIP_GOAL_LABELS: Record<RelationshipGoalKey, string> = {
  earn_first_reply: "Earn first reply",
  build_credibility: "Build credibility",
  validate_operational_pain: "Validate operational pain",
  expand_committee: "Expand committee",
  identify_champion: "Identify champion",
  recover_trust: "Recover trust",
  support_opportunity: "Support opportunity",
  prepare_executive_conversation: "Prepare executive conversation",
  protect_relationship: "Protect relationship",
  walk_away: "Walk away",
}
