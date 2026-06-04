/** Client-safe Growth Engine sequence intelligence types. */

export const GROWTH_SEQUENCE_FATIGUE_RISKS = ["none", "low", "medium", "high"] as const
export type GrowthSequenceFatigueRisk = (typeof GROWTH_SEQUENCE_FATIGUE_RISKS)[number]

export const GROWTH_SEQUENCE_PATTERN_KINDS = ["catalog", "detected"] as const
export type GrowthSequencePatternKind = (typeof GROWTH_SEQUENCE_PATTERN_KINDS)[number]

export const GROWTH_SEQUENCE_STEP_CHANNELS = [
  "email",
  "sms",
  "call",
  "manual_call",
  "voicemail",
  "linkedin_view_profile",
  "linkedin_connect",
  "linkedin_message",
  "sms_task",
  "meeting_followup",
  "manual_task",
  "manual_follow_up",
] as const
export type GrowthSequenceStepChannel = (typeof GROWTH_SEQUENCE_STEP_CHANNELS)[number]

export const GROWTH_SEQUENCE_EXPECTED_SIGNALS = [
  "reply",
  "positive_reply",
  "call_connected",
  "meeting_signal",
  "follow_up_completed",
  "no_signal",
] as const
export type GrowthSequenceExpectedSignal = (typeof GROWTH_SEQUENCE_EXPECTED_SIGNALS)[number]

export type GrowthSequencePatternStep = {
  id: string
  patternId: string
  stepOrder: number
  channel: GrowthSequenceStepChannel
  delayDaysMin: number
  delayDaysMax: number
  generationType: string | null
  playbookCategory: string | null
  requiredHumanApproval: boolean
  expectedSignal: GrowthSequenceExpectedSignal
}

export type GrowthSequencePattern = {
  id: string
  key: string
  label: string
  description: string | null
  patternKind: GrowthSequencePatternKind
  sequenceVersion: number
  isActive: boolean
  minTouches: number
  maxObservationDays: number
  attemptCount: number
  replyRate: number
  positiveReplyRate: number
  meetingSignalRate: number
  followUpCompletionRate: number
  sequenceAbandonmentRate: number
  opportunityLift: number
  revenueProbabilityLift: number
  conversationHealthLift: number
  averageTimeToReplyHours: number | null
  averageTouchesToPositiveSignal: number | null
  sequenceQualityScore: number
  sequenceFatigueRisk: GrowthSequenceFatigueRisk
  confidenceScore: number
  computedAt: string | null
  steps: GrowthSequencePatternStep[]
}

export type GrowthSequenceTouch = {
  occurredAt: string
  channel: GrowthSequenceStepChannel | "reply" | "unknown"
  generationType: string | null
  queueId?: string | null
  messageId?: string | null
  callEventId?: string | null
  signalKind?: string | null
}

export type GrowthSequenceRecommendedNextStep = {
  stepOrder: number
  channel: GrowthSequenceStepChannel
  generationType: string | null
  delayDays: number
  expectedSignal: GrowthSequenceExpectedSignal
  requiredHumanApproval: boolean
}

export type GrowthSequencePatternOutcome = {
  patternId: string
  leadId: string
  startedAt: string
  completedAt: string | null
  gotReply: boolean
  gotPositiveReply: boolean
  gotMeetingSignal: boolean
  followUpCompleted: boolean
  abandoned: boolean
  timeToReplyHours: number | null
  touchesToPositiveSignal: number | null
  opportunityScoreBefore: number | null
  opportunityScoreAfter: number | null
  revenueProbabilityBefore: number | null
  revenueProbabilityAfter: number | null
  conversationHealthBefore: number | null
  conversationHealthAfter: number | null
  leadIndustryBucket: string | null
  dominantObjectionKey: string | null
  buyingIntentAtStart: string | null
}

export type GrowthSequenceRecommendationResult = {
  patternId: string | null
  patternKey: string | null
  reason: string | null
  confidence: number
  nextStep: GrowthSequenceRecommendedNextStep | null
  fatigueRisk: GrowthSequenceFatigueRisk
}

export const GROWTH_SEQUENCE_CATALOG_KEYS = [
  "cold_email_only",
  "email_then_call",
  "call_then_email",
  "follow_up_after_reply",
  "executive_follow_up",
  "reengagement_sequence",
] as const
export type GrowthSequenceCatalogKey = (typeof GROWTH_SEQUENCE_CATALOG_KEYS)[number]
