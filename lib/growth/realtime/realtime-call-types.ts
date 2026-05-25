/** Client-safe Growth Engine Realtime Call Intelligence types. */

export const GROWTH_BROWSER_AUDIO_CAPTURE_STATUSES = [
  "inactive",
  "requesting",
  "active",
  "paused",
  "stopped",
  "failed",
] as const
export type GrowthBrowserAudioCaptureStatus = (typeof GROWTH_BROWSER_AUDIO_CAPTURE_STATUSES)[number]

export const GROWTH_REALTIME_CALL_SESSION_STATUSES = [
  "preparing",
  "active",
  "paused",
  "completed",
  "discarded",
] as const
export type GrowthRealtimeCallSessionStatus = (typeof GROWTH_REALTIME_CALL_SESSION_STATUSES)[number]

export const GROWTH_REALTIME_CALL_TRANSCRIPT_STATUSES = [
  "inactive",
  "connecting",
  "live",
  "failed",
] as const
export type GrowthRealtimeCallTranscriptStatus = (typeof GROWTH_REALTIME_CALL_TRANSCRIPT_STATUSES)[number]

export const GROWTH_REALTIME_CALL_SPEAKERS = ["rep", "prospect", "system"] as const
export type GrowthRealtimeCallSpeaker = (typeof GROWTH_REALTIME_CALL_SPEAKERS)[number]

export const GROWTH_REALTIME_OBJECTION_KEYS = [
  "pricing_objection",
  "timing_objection",
  "already_using_solution",
  "budget_concern",
  "feature_gap",
  "competitor_mention",
  "authority_objection",
  "priority_objection",
] as const
export type GrowthRealtimeObjectionKey = (typeof GROWTH_REALTIME_OBJECTION_KEYS)[number]

export const GROWTH_REALTIME_BUYING_SIGNAL_KEYS = [
  "buying_signal",
  "implementation_signal",
  "timeline_urgency",
  "commitment_language",
  "decision_maker_confirmed",
  "pricing_interest",
] as const
export type GrowthRealtimeBuyingSignalKey = (typeof GROWTH_REALTIME_BUYING_SIGNAL_KEYS)[number]

export const GROWTH_REALTIME_RISK_FLAGS = [
  "talking_too_much",
  "not_enough_questions",
  "low_discovery",
  "negative_sentiment_shift",
  "multiple_objections_stacking",
  "no_next_step_identified",
  "call_momentum_slowing",
  "executive_account_risk",
] as const
export type GrowthRealtimeRiskFlag = (typeof GROWTH_REALTIME_RISK_FLAGS)[number]

export const GROWTH_REALTIME_DISCOVERY_AREAS = [
  "timeline_asked",
  "budget_asked",
  "implementation_asked",
  "decision_maker_confirmed",
  "current_solution_identified",
] as const
export type GrowthRealtimeDiscoveryArea = (typeof GROWTH_REALTIME_DISCOVERY_AREAS)[number]

export type GrowthRealtimeTranscriptEvent = {
  id: string
  sessionId: string
  speaker: GrowthRealtimeCallSpeaker
  content: string
  sequenceNumber: number
  timestampMs: number
  createdAt: string
}

export type GrowthRealtimeDetectedObjection = {
  key: GrowthRealtimeObjectionKey
  label: string
  excerpt: string
  sequenceNumber: number
}

export type GrowthRealtimeDetectedBuyingSignal = {
  key: GrowthRealtimeBuyingSignalKey
  label: string
  excerpt: string
  sequenceNumber: number
}

export type GrowthRealtimeTalkRatio = {
  repTalkPercent: number
  prospectTalkPercent: number
  repWordCount: number
  prospectWordCount: number
  inGoalRange: boolean
  flags: Array<"talking_too_much" | "not_enough_questions">
}

export type GrowthRealtimeDiscoveryCoverage = {
  covered: GrowthRealtimeDiscoveryArea[]
  missing: GrowthRealtimeDiscoveryArea[]
}

export type GrowthRealtimeCompetitorGuidance = {
  competitor: string
  suggestedAngle: string
}

export type GrowthRealtimeGuidanceTip = {
  id: string
  message: string
  priority: "high" | "medium" | "low"
}

export type GrowthRealtimeLiveSnapshot = {
  objections: GrowthRealtimeDetectedObjection[]
  buyingSignals: GrowthRealtimeDetectedBuyingSignal[]
  talkRatio: GrowthRealtimeTalkRatio
  discovery: GrowthRealtimeDiscoveryCoverage
  riskFlags: GrowthRealtimeRiskFlag[]
  competitorGuidance: GrowthRealtimeCompetitorGuidance[]
  recommendedNextQuestion: string | null
  recommendedResponse: string | null
  guidanceTips: GrowthRealtimeGuidanceTip[]
  computedAt: string
}

export type GrowthRealtimeCallSession = {
  id: string
  leadId: string
  callCopilotSessionId: string | null
  status: GrowthRealtimeCallSessionStatus
  startedAt: string | null
  endedAt: string | null
  liveGuidanceMode: "manual" | "future_realtime"
  transcriptStatus: GrowthRealtimeCallTranscriptStatus
  guidanceEnabled: boolean
  riskMonitoringEnabled: boolean
  liveSnapshot: GrowthRealtimeLiveSnapshot
  realtimeProviderConnectionId: string | null
  providerId: string | null
  transcriptSource: "manual" | "stub" | "provider" | "browser_mic" | "meeting_audio"
  transcriptQualityScore: number
  guidanceLatencyMs: number
  sessionProviderFailoverCount: number
  browserAudioCaptureEnabled: boolean
  browserAudioCaptureStatus: GrowthBrowserAudioCaptureStatus
  browserAudioStartedAt: string | null
  browserAudioEndedAt: string | null
  browserAudioError: string | null
  meetingCaptureMode: "microphone" | "browser_tab" | "mixed_audio" | "meeting_mode" | null
  meetingProvider: "google_meet" | "zoom_web" | "microsoft_teams_web" | "generic_browser_audio" | null
  mixedAudioEnabled: boolean
  meetingAudioActive: boolean
  microphoneActive: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthLeadRealtimeIntelligenceInput = {
  decisionMakerStatus?: string | null
  conversationUrgencyLevel?: string | null
  conversationBuyingIntent?: string | null
  conversationSentiment?: string | null
  conversationMomentum?: string | null
  relationshipTrend?: string | null
  opportunityReadinessTier?: string | null
  revenueTrajectory?: string | null
  revenueProbabilityTier?: string | null
  executivePriorityTier?: string | null
  recommendedSequenceNextStep?: { channel?: string | null } | null
  conversationCompetitorPressure?: number | null
}
