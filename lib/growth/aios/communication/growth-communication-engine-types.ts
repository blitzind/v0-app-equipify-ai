/** GE-AI-2K — Communication Engine types (client-safe). */

import type { GrowthLearningCommunicationAdvisory } from "@/lib/growth/aios/learning/growth-closed-loop-learning-types"

export const GROWTH_AIOS_GE_AI_2K_PHASE = "GE-AI-2K" as const

export const GROWTH_COMMUNICATION_ENGINE_PHASE = GROWTH_AIOS_GE_AI_2K_PHASE

export const GROWTH_COMMUNICATION_ENGINE_QA_MARKER = "growth-ge-ai-2k-communication-engine-v1" as const

export const GROWTH_COMMUNICATION_ENGINE_RUNTIME_RULE =
  "Communication Engine is read-only planning — it produces channel strategy and step plans without sending, bypassing transports, or mutating Core." as const

export const GROWTH_COMMUNICATION_ENGINE_RANKING_FORMULA =
  "channelScore = engagementWeight * 0.30 + readinessWeight * 0.25 + policyWeight * 0.25 + signalWeight * 0.20 (deterministic tie-break: channel asc)" as const

export const GROWTH_COMMUNICATION_SUBJECT_TYPES = [
  "lead",
  "company",
  "person",
  "customer",
  "objective",
  "mission",
  "campaign",
  "sequence",
] as const

export type GrowthCommunicationSubjectType = (typeof GROWTH_COMMUNICATION_SUBJECT_TYPES)[number]

export const GROWTH_COMMUNICATION_GOALS = [
  "book_meeting",
  "qualify",
  "follow_up",
  "revive",
  "nurture",
  "confirm_meeting",
  "collect_payment",
  "customer_success",
  "service_follow_up",
  "other",
] as const

export type GrowthCommunicationGoal = (typeof GROWTH_COMMUNICATION_GOALS)[number]

export const GROWTH_COMMUNICATION_STRATEGIES = [
  "email_first",
  "sms_first",
  "call_first",
  "video_first",
  "multi_touch",
  "wait",
  "human_review",
  "do_not_contact",
] as const

export type GrowthCommunicationStrategy = (typeof GROWTH_COMMUNICATION_STRATEGIES)[number]

export const GROWTH_COMMUNICATION_CHANNELS = [
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

export type GrowthCommunicationChannel = (typeof GROWTH_COMMUNICATION_CHANNELS)[number]

export const GROWTH_COMMUNICATION_ACTION_TYPES = [
  "send_email",
  "send_sms",
  "place_call",
  "launch_voice_drop",
  "start_ai_voice",
  "send_video",
  "send_sendr_page",
  "create_linkedin_task",
  "wait",
  "request_human_review",
] as const

export type GrowthCommunicationActionType = (typeof GROWTH_COMMUNICATION_ACTION_TYPES)[number]

export const GROWTH_COMMUNICATION_TIMING_MODES = [
  "immediate",
  "delay",
  "scheduled",
  "after_event",
] as const

export type GrowthCommunicationTimingMode = (typeof GROWTH_COMMUNICATION_TIMING_MODES)[number]

export const GROWTH_COMMUNICATION_AFTER_EVENTS = [
  "no_reply",
  "reply",
  "positive_intent",
  "negative_intent",
  "meeting_booked",
  "website_visit",
  "video_view",
] as const

export type GrowthCommunicationAfterEvent = (typeof GROWTH_COMMUNICATION_AFTER_EVENTS)[number]

export const GROWTH_COMMUNICATION_FALLBACK_REASONS = [
  "blocked",
  "no_reply",
  "low_engagement",
  "channel_unavailable",
  "manual_review",
] as const

export type GrowthCommunicationFallbackReason = (typeof GROWTH_COMMUNICATION_FALLBACK_REASONS)[number]

export type GrowthCommunicationPlanSubject = {
  type: GrowthCommunicationSubjectType
  id: string
}

export type GrowthCommunicationPlanStep = {
  stepNumber: number
  channel: GrowthCommunicationChannel
  actionType: GrowthCommunicationActionType
  timing: {
    mode: GrowthCommunicationTimingMode
    delayHours?: number
    afterEvent?: GrowthCommunicationAfterEvent
  }
  templateId?: string
  contentIntent?: string
  requiresHumanApproval: boolean
  requiredChecks: string[]
  fallbackIfBlocked?: number
}

export type GrowthCommunicationPlanFallback = {
  fromStep: number
  reason: GrowthCommunicationFallbackReason
  toStep: number
}

export type GrowthCommunicationPlanStopConditions = {
  onReply: boolean
  onPositiveIntent: boolean
  onNegativeIntent: boolean
  onOptOut: boolean
  onMeetingBooked: boolean
  onBounce: boolean
  onManualPause: boolean
}

export type GrowthCommunicationPlanPolicy = {
  requiresHumanApproval: boolean
  autonomyCapability?: string
  allowedChannels: string[]
  blockedChannels: Array<{ channel: string; reason: string }>
}

export type GrowthCommunicationPlanEvidence = {
  source: string
  label: string
  value?: string | number | boolean
  confidence?: number
}

export type GrowthCommunicationPlan = {
  id: string
  organizationId: string
  subject: GrowthCommunicationPlanSubject
  goal: GrowthCommunicationGoal
  recommendedStrategy: GrowthCommunicationStrategy
  steps: GrowthCommunicationPlanStep[]
  fallbackStrategy: GrowthCommunicationPlanFallback[]
  stopConditions: GrowthCommunicationPlanStopConditions
  policy: GrowthCommunicationPlanPolicy
  evidence: GrowthCommunicationPlanEvidence[]
  confidence: number
  routeHints: Array<{ label: string; href: string }>
  createdAt: string
}

export type GrowthCommunicationEngineContext = {
  suppressionBlocked?: boolean
  optOutBlocked?: boolean
  senderReady?: boolean
  emailReady?: boolean
  smsReady?: boolean
  voiceDropCertified?: boolean
  aiVoiceExplicitlyAllowed?: boolean
  autonomyOutboundEnabled?: boolean
  autonomyEnabled?: boolean
  emergencyStopActive?: boolean
  replyReceived?: boolean
  positiveIntent?: boolean
  negativeIntent?: boolean
  meetingBooked?: boolean
  bounceDetected?: boolean
  engagementScore?: number
  quietHoursActive?: boolean
  scopeAllowedChannels?: string[]
  metaRecommendationType?: string
  priorityScore?: number
  rankingWeights?: {
    engagement: number
    readiness: number
    policy: number
    signal: number
  }
  /** SDR-1A — plan for human-approved execution; skip autonomy-outbound channel blocks. */
  humanApprovalPlanningMode?: boolean
}

export type GrowthCommunicationEngineReadModel = {
  readOnly: true
  qaMarker: typeof GROWTH_COMMUNICATION_ENGINE_QA_MARKER
  generatedAt: string
  rule: typeof GROWTH_COMMUNICATION_ENGINE_RUNTIME_RULE
  rankingFormula: typeof GROWTH_COMMUNICATION_ENGINE_RANKING_FORMULA
  summary: {
    plansGenerated: number
    primaryStrategy: GrowthCommunicationStrategy | null
    blockedChannelCount: number
    averageConfidence: number
    topChannel: GrowthCommunicationChannel | null
  }
  plans: GrowthCommunicationPlan[]
  learningAdvisory?: GrowthLearningCommunicationAdvisory
}

export const GROWTH_COMMUNICATION_ENGINE_EVENT_TYPES = {
  planGenerated: "growth.communication.plan_generated",
} as const
