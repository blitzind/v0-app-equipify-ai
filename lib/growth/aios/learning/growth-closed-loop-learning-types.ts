/** GE-AI-3D — Closed-Loop Learning Foundation types (client-safe). */

export const GROWTH_AIOS_GE_AI_3D_PHASE = "GE-AI-3D" as const

export const GROWTH_AIOS_GE_AI_3D_PROD_1_PHASE = "GE-AI-3D-PROD-1" as const

export const GROWTH_CLOSED_LOOP_LEARNING_QA_MARKER =
  "growth-ge-ai-3d-closed-loop-learning-foundation-v1" as const

export const GROWTH_CLOSED_LOOP_LEARNING_PERSISTENCE_QA_MARKER =
  "growth-ge-ai-3d-prod-1-durable-closed-loop-learning-v1" as const

export const GROWTH_CLOSED_LOOP_LEARNING_SCHEMA_MIGRATION =
  "20271001230000_growth_ai_3d_prod_1_closed_loop_learning_store.sql" as const

export const GROWTH_CLOSED_LOOP_LEARNING_RULE =
  "Closed-loop learning observes and normalizes outcomes into advisory insights — no automatic score mutation, no policy changes, no transport execution, no Core mutations." as const

export const GROWTH_CLOSED_LOOP_LEARNING_SUBSCRIBER_ID = "learning_observer" as const

export const GROWTH_LEARNING_OUTCOME_SOURCES = [
  "revenue_director",
  "workflow_agent",
  "autonomous_outbound",
  "email",
  "sms",
  "call",
  "voice_drop",
  "video",
  "sendr",
  "website",
  "form",
  "chat",
  "meeting",
  "campaign",
  "sequence",
  "human_approval",
  "customer_lifecycle",
] as const

export type GrowthLearningOutcomeSource = (typeof GROWTH_LEARNING_OUTCOME_SOURCES)[number]

export const GROWTH_LEARNING_OUTCOME_TYPES = [
  "completed",
  "failed",
  "reply",
  "positive_intent",
  "negative_intent",
  "meeting_booked",
  "bounce",
  "unsubscribe",
  "opt_out",
  "viewed",
  "clicked",
  "converted",
  "rejected",
  "approved",
  "cancelled",
  "no_response",
  "stalled",
] as const

export type GrowthLearningOutcomeType = (typeof GROWTH_LEARNING_OUTCOME_TYPES)[number]

export const GROWTH_LEARNING_SUBJECT_TYPES = [
  "lead",
  "person",
  "company",
  "customer",
  "objective",
  "mission",
  "campaign",
  "sequence",
  "scope",
  "workflow_request",
] as const

export type GrowthLearningSubjectType = (typeof GROWTH_LEARNING_SUBJECT_TYPES)[number]

export const GROWTH_LEARNING_CHANNELS = [
  "email",
  "sms",
  "call",
  "voice_drop",
  "ai_voice",
  "video",
  "sendr",
  "linkedin_manual",
  "website",
  "chat",
] as const

export type GrowthLearningChannel = (typeof GROWTH_LEARNING_CHANNELS)[number]

export type GrowthLearningOutcomeEvidence = {
  source: string
  label: string
  value?: string | number | boolean
  confidence?: number
}

export type GrowthLearningOutcome = {
  id: string
  organizationId: string
  source: GrowthLearningOutcomeSource
  outcomeType: GrowthLearningOutcomeType
  subject: {
    type: GrowthLearningSubjectType
    id: string
  }
  related: {
    workflowRequestId?: string
    decisionId?: string
    autonomousScopeId?: string
    actionId?: string
    communicationPlanId?: string
    campaignId?: string
    sequenceId?: string
  }
  signalStrength: number
  confidence: number
  dimensions: {
    channel?: GrowthLearningChannel
    icpSegment?: string
    industry?: string
    companySize?: string
    persona?: string
    messageTheme?: string
    businessPressureKey?: string
    discoveryQuestionTheme?: string
    revenueStrategyRecommendation?: string
    entryPointRole?: string
    channelStrategy?: string
    committeeStrategy?: string
    timingBucket?: string
  }
  evidence: GrowthLearningOutcomeEvidence[]
  occurredAt: string
  createdAt: string
}

export const GROWTH_LEARNING_INSIGHT_TYPES = [
  "channel_performance",
  "message_performance",
  "icp_fit",
  "timing",
  "qualification_accuracy",
  "research_quality",
  "forecast_accuracy",
  "approval_friction",
  "outbound_risk",
  "objective_progress",
] as const

export type GrowthLearningInsightType = (typeof GROWTH_LEARNING_INSIGHT_TYPES)[number]

export const GROWTH_LEARNING_RECOMMENDED_ADJUSTMENTS = [
  "increase_weight",
  "decrease_weight",
  "test_variant",
  "pause",
  "monitor",
  "human_review",
  "no_change",
] as const

export type GrowthLearningRecommendedAdjustment =
  (typeof GROWTH_LEARNING_RECOMMENDED_ADJUSTMENTS)[number]

export const GROWTH_LEARNING_TARGET_SYSTEMS = [
  "communication_engine",
  "meta_recommender",
  "priority_engine",
  "qualification_agent",
  "research_agent",
  "revenue_director",
  "campaign_optimization",
  "icp_learning",
  "forecasting",
] as const

export type GrowthLearningTargetSystem = (typeof GROWTH_LEARNING_TARGET_SYSTEMS)[number]

export const GROWTH_LEARNING_INSIGHT_STATUSES = [
  "advisory",
  "needs_review",
  "not_enough_data",
] as const

export type GrowthLearningInsightStatus = (typeof GROWTH_LEARNING_INSIGHT_STATUSES)[number]

export type GrowthLearningInsight = {
  id: string
  organizationId: string
  insightType: GrowthLearningInsightType
  title: string
  summary: string
  recommendedAdjustment: GrowthLearningRecommendedAdjustment
  targetSystem: GrowthLearningTargetSystem
  confidence: number
  impact: number
  sampleSize: number
  evidence: GrowthLearningOutcome[]
  status: GrowthLearningInsightStatus
  createdAt: string
}

export const GROWTH_CLOSED_LOOP_LEARNING_EVENT_TYPES = {
  outcomeObserved: "growth.learning.outcome_observed",
  insightGenerated: "growth.learning.insight_generated",
} as const

export const GROWTH_LEARNING_MIN_SAMPLE_SIZE = 3 as const

export const GROWTH_LEARNING_OUTCOME_STORE_MAX = 500 as const

export type GrowthClosedLoopLearningReadModel = {
  readOnly: true
  advisoryOnly: true
  qaMarker: typeof GROWTH_CLOSED_LOOP_LEARNING_QA_MARKER
  generatedAt: string
  rule: typeof GROWTH_CLOSED_LOOP_LEARNING_RULE
  schemaReady: boolean
  persistenceMode: "durable" | "empty" | "in_memory_test"
  lastGeneratedAt: string | null
  summary: {
    outcomesObserved: number
    insightsGenerated: number
    topInsightType: GrowthLearningInsightType | null
    averageConfidence: number
    notEnoughDataCount: number
  }
  outcomes: GrowthLearningOutcome[]
  insights: GrowthLearningInsight[]
  eventObservation: {
    subscriberId: typeof GROWTH_CLOSED_LOOP_LEARNING_SUBSCRIBER_ID
    eventsReceived: number
    lastEventType: string | null
  }
}

export function buildLearningOutcomeIdempotencyKey(organizationId: string, eventId: string): string {
  return `learning-outcome:${organizationId}:${eventId}`
}

export function buildLearningInsightIdempotencyKey(input: {
  organizationId: string
  insightType: GrowthLearningInsightType
  generatedFromWindow: string
}): string {
  return `learning-insight:${input.organizationId}:${input.insightType}:${input.generatedFromWindow}`
}

export function resolveLearningInsightWindow(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 10)
}

export type GrowthLearningAdvisoryContext = {
  topInsight: GrowthLearningInsight | null
  riskTrend: "stable" | "rising" | "falling" | "unknown"
  channelTrend: string | null
  approvalFriction: number | null
  objectiveProgressSignal: string | null
}

export type GrowthLearningCommunicationAdvisory = {
  advisoryNote: string | null
  channelComparison: string | null
  readOnly: true
}
