/** GS-AI-PLAYBOOK-4C — Sequence intelligence types (client-safe). */

export const GROWTH_SEQUENCE_INTELLIGENCE_QA_MARKER =
  "growth-sequence-intelligence-gs-ai-playbook-4c-v1" as const

export type GrowthSequenceStateKey =
  | "first_touch"
  | "early_sequence"
  | "engaged_sequence"
  | "active_conversation"
  | "evaluation_sequence"
  | "reengagement_sequence"
  | "stalled_sequence"
  | "late_sequence"
  | "exhausted_sequence"

export type GrowthSequenceNarrativeTheme =
  | "industry_pain"
  | "compliance_pain"
  | "workflow_pain"
  | "growth_pain"
  | "financial_pain"
  | "case_study"
  | "comparison"
  | "roi_proof"
  | "social_proof"

export type GrowthSequenceProofStage =
  | "industry_understanding"
  | "operational_proof"
  | "customer_example"
  | "roi_proof"
  | "implementation_proof"

export type GrowthSequenceCtaStage =
  | "question"
  | "workflow_review"
  | "case_study"
  | "meeting"
  | "implementation_discussion"

export type GrowthSequenceEngagementTrend = "interestIncreasing" | "interestFlat" | "interestDecreasing"

export type GrowthSequenceFatigueLevel = "none" | "low" | "medium" | "high"

export type GrowthSequenceHistoryTouch = {
  index: number
  channel: string | null
  subject: string | null
  summary: string
  observedAt: string | null
  source: "outbound_message" | "queue_item" | "sequence_step" | "timeline" | "memory"
}

export type GrowthSequenceMetrics = {
  touchCount: number
  daysInSequence: number | null
  lastTouchDays: number | null
  opens: number
  clicks: number
  replies: number
  meetings: number
  assetViews: number
  responseTrend: GrowthSequenceEngagementTrend
}

export type GrowthSequenceNarrativeProgression = {
  usedThemes: GrowthSequenceNarrativeTheme[]
  unusedThemes: GrowthSequenceNarrativeTheme[]
  overusedThemes: GrowthSequenceNarrativeTheme[]
  recommendedThemes: GrowthSequenceNarrativeTheme[]
}

export type GrowthSequenceProofProgression = {
  usedProofStages: GrowthSequenceProofStage[]
  recommendedProof: GrowthSequenceProofStage
  avoidProofStages: GrowthSequenceProofStage[]
}

export type GrowthSequenceCtaProgression = {
  usedCtaStages: GrowthSequenceCtaStage[]
  currentCtaStage: GrowthSequenceCtaStage
  recommendedCta: string
  avoidCtas: string[]
}

export type GrowthSequenceEngagementProgression = {
  engagementTrend: GrowthSequenceEngagementTrend
  confidence: number
  recommendedApproach: string
}

export type GrowthSequenceFatigueAssessment = {
  fatigueLevel: GrowthSequenceFatigueLevel
  reasons: string[]
  recommendations: string[]
}

export type GrowthSequenceGuidance = {
  sequenceState: GrowthSequenceStateKey
  nextNarrative: GrowthSequenceNarrativeTheme
  nextProof: GrowthSequenceProofStage
  nextCta: GrowthSequenceCtaStage
  engagementTrend: GrowthSequenceEngagementTrend
  fatigueLevel: GrowthSequenceFatigueLevel
  avoidPatterns: string[]
  confidence: number
}

export type GrowthSequenceDiagnostics = {
  sequenceState: GrowthSequenceStateKey
  touchCount: number
  progression: {
    narrative: GrowthSequenceNarrativeProgression
    proof: GrowthSequenceProofProgression
    cta: GrowthSequenceCtaProgression
    engagement: GrowthSequenceEngagementProgression
    fatigue: GrowthSequenceFatigueAssessment
  }
  narrativeHistory: GrowthSequenceNarrativeTheme[]
  proofHistory: GrowthSequenceProofStage[]
  ctaHistory: GrowthSequenceCtaStage[]
  engagementTrend: GrowthSequenceEngagementTrend
  fatigue: GrowthSequenceFatigueAssessment
  guidance: GrowthSequenceGuidance
  guidanceApplied: boolean
}

export type GrowthSequenceIntelligenceContext = {
  metrics: GrowthSequenceMetrics
  history: GrowthSequenceHistoryTouch[]
  diagnostics: GrowthSequenceDiagnostics
}

export type GrowthSequenceSignalInput = {
  priorTouchCount?: number
  priorTouchSummaries?: string[]
  priorOutboundSubjects?: string[]
  priorReplySummaries?: string[]
  sequenceHistorySummaries?: string[]
  timelineEventSummaries?: string[]
  memoryInteractionSummaries?: string[]
  memoryAvoidRepeating?: string[]
  memoryEngagementTrend?: string | null
  engagementScore?: number | null
  daysSinceLastTouch?: number | null
  daysInSequence?: number | null
  emailOpens?: number
  emailClicks?: number
  meetings?: number
  assetViews?: number
  videoViews?: number
  sharePageViews?: number
  hasActiveSequence?: boolean
  sequenceStepIndex?: number | null
  buyingStage?: string | null
  conversationState?: string | null
  regenerationCategory?: string | null
}
