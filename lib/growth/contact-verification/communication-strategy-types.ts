/**
 * GE-AIOS-SDR-1A — Unified Communication Strategy artifact (client-safe).
 * Authoritative multichannel strategy derived from IRE stack + Communication Engine.
 * Read-only. Never executes.
 */

export const GROWTH_COMMUNICATION_STRATEGY_QA_MARKER = "communication-strategy-engine-v1" as const

export type CommunicationStrategyVersion = 1

export type CommunicationStrategyChannel =
  | "email"
  | "phone"
  | "sms"
  | "voice_drop"
  | "linkedin"
  | "video"
  | "wait"
  | "stop"
  | "human"

export type CommunicationStrategyRecommendedAction =
  | "send_email"
  | "place_call"
  | "launch_voice_drop"
  | "send_sms"
  | "create_linkedin_task"
  | "send_video"
  | "schedule_meeting"
  | "wait"
  | "stop"
  | "request_human_review"

export type CommunicationStrategyEscalationStep = {
  order: number
  channel: CommunicationStrategyChannel
  action: CommunicationStrategyRecommendedAction
  trigger: string
  delayHours?: number
  afterEvent?: string
}

export type CommunicationStrategyTouchChannel =
  | "email"
  | "phone"
  | "sms"
  | "voice_drop"
  | "linkedin"
  | "video"

/** Engagement + touch history — no new scoring, flags only. */
export type CommunicationStrategyTouchHistory = {
  emailSentCount?: number
  emailReplyCount?: number
  daysSinceLastEmail?: number
  lastEmailNoReply?: boolean
  callAttempted?: boolean
  callConnected?: boolean
  callNoAnswer?: boolean
  voiceDropSent?: boolean
  voiceDropDelivered?: boolean
  hoursSinceVoiceDrop?: number
  smsSentCount?: number
  smsReplyCount?: number
  linkedinTaskCreated?: boolean
  videoSent?: boolean
  meetingBooked?: boolean
  positiveReply?: boolean
  negativeReply?: boolean
  notInterested?: boolean
  unsubscribed?: boolean
  suppressed?: boolean
  waitPeriodElapsed?: boolean
  lastTouchChannel?: CommunicationStrategyTouchChannel | null
  sequenceActive?: boolean
  sequenceStepChannel?: string | null
  engagementScore?: number
}

export type CommunicationStrategyChannelCapabilities = {
  email?: boolean
  phone?: boolean
  sms?: boolean
  voiceDrop?: boolean
  linkedin?: boolean
  video?: boolean
  emailReady?: boolean
  smsReady?: boolean
  voiceDropCertified?: boolean
}

export type CommunicationStrategy = {
  version: CommunicationStrategyVersion
  qa_marker: typeof GROWTH_COMMUNICATION_STRATEGY_QA_MARKER
  companyId: string
  generatedAt: string
  primaryChannel: CommunicationStrategyChannel
  fallbackChannels: CommunicationStrategyChannel[]
  recommendedAction: CommunicationStrategyRecommendedAction
  reasoning: string[]
  escalationPlan: CommunicationStrategyEscalationStep[]
  stopConditions: string[]
  waitConditions: string[]
  confidence: number
  requiresHumanApproval: boolean
  communicationPlanId?: string | null
  source: "communication_strategy_engine"
}

export type CommunicationStrategyDisplaySummary = {
  qa_marker: typeof GROWTH_COMMUNICATION_STRATEGY_QA_MARKER
  primary_channel: string
  primary_channel_label: string
  recommended_action: string
  recommended_action_label: string
  fallback_channels: string[]
  confidence: number
  reasoning: string[]
  escalation_summary: string
  requires_human_approval: boolean
  source: "communication_strategy_engine"
}

/** Standard SDR escalation ladder (SDR-1A v1). */
export const COMMUNICATION_STRATEGY_ESCALATION_LADDER: readonly CommunicationStrategyEscalationStep[] = [
  {
    order: 1,
    channel: "email",
    action: "send_email",
    trigger: "Initial outreach to verified executive contact",
    delayHours: 0,
  },
  {
    order: 2,
    channel: "phone",
    action: "place_call",
    trigger: "No email reply after 4 days",
    delayHours: 96,
    afterEvent: "no_reply",
  },
  {
    order: 3,
    channel: "voice_drop",
    action: "launch_voice_drop",
    trigger: "Call not answered",
    delayHours: 0,
    afterEvent: "no_answer",
  },
  {
    order: 4,
    channel: "sms",
    action: "send_sms",
    trigger: "No voice drop response after 48 hours",
    delayHours: 48,
    afterEvent: "no_reply",
  },
  {
    order: 5,
    channel: "linkedin",
    action: "create_linkedin_task",
    trigger: "No SMS reply",
    delayHours: 72,
    afterEvent: "no_reply",
  },
  {
    order: 6,
    channel: "wait",
    action: "wait",
    trigger: "No LinkedIn activity — wait 30 days",
    delayHours: 720,
    afterEvent: "no_activity",
  },
  {
    order: 7,
    channel: "email",
    action: "send_email",
    trigger: "Retry after wait period",
    delayHours: 0,
    afterEvent: "wait_elapsed",
  },
] as const
