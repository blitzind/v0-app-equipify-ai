/** Growth Engine F1 — Video Autopilot recommendation types (client-safe). */

export const GROWTH_VIDEO_AUTOPILOT_QA_MARKER = "growth-video-autopilot-f1-v1" as const

export const GROWTH_VIDEO_AUTOPILOT_CONFIRM = "RUN_GROWTH_VIDEO_AUTOPILOT_CERTIFICATION" as const

export const GROWTH_VIDEO_AUTOPILOT_METADATA_KEY = "growth_video_autopilot_f1" as const

export const GROWTH_VIDEO_AUTOPILOT_RECOMMENDATION_STATUSES = [
  "draft",
  "approved",
  "dismissed",
] as const

export type GrowthVideoAutopilotRecommendationStatus =
  (typeof GROWTH_VIDEO_AUTOPILOT_RECOMMENDATION_STATUSES)[number]

export const GROWTH_VIDEO_AUTOPILOT_VIDEO_TYPES = [
  "quick_intro",
  "follow_up",
  "proposal_walkthrough",
  "meeting_recap",
  "case_study",
  "reengagement",
] as const

export type GrowthVideoAutopilotVideoType = (typeof GROWTH_VIDEO_AUTOPILOT_VIDEO_TYPES)[number]

export const GROWTH_VIDEO_AUTOPILOT_CHANNELS = ["email", "sms", "voice_drop"] as const

export type GrowthVideoAutopilotChannel = (typeof GROWTH_VIDEO_AUTOPILOT_CHANNELS)[number]

export const GROWTH_VIDEO_AUTOPILOT_PRIORITIES = ["low", "medium", "high", "urgent"] as const

export type GrowthVideoAutopilotPriority = (typeof GROWTH_VIDEO_AUTOPILOT_PRIORITIES)[number]

export const GROWTH_VIDEO_AUTOPILOT_SCORE_REASONS = [
  "high_fit",
  "high_intent",
  "recent_engagement",
  "return_visitor",
  "meeting_ready",
  "reengagement_needed",
] as const

export type GrowthVideoAutopilotScoreReason = (typeof GROWTH_VIDEO_AUTOPILOT_SCORE_REASONS)[number]

export type GrowthVideoAutopilotRecommendedAssets = {
  script: string | null
  thumbnailText: string | null
  overlayText: string | null
  ctaLabel: string | null
  ctaUrl: string | null
  calendarUrl: string | null
  voiceEnabled: boolean
  avatarEnabled: boolean
  channel: GrowthVideoAutopilotChannel
  followUpSummary: string | null
}

export type GrowthVideoAutopilotScores = {
  videoOpportunityScore: number
  personalizationScore: number
  recommendedPriority: GrowthVideoAutopilotPriority
  reasons: GrowthVideoAutopilotScoreReason[]
}

export type GrowthVideoAutopilotInputSnapshot = {
  leadId: string
  companyName: string | null
  contactName: string | null
  industry: string | null
  companySize: string | null
  painPoints: string[]
  fitScore: number | null
  momentumScore: number | null
  buyingCommitteeSummary: string | null
  researchSummary: string | null
  engagementSummary: string | null
  relationshipSummary: string | null
  nextBestAction: string | null
  videoIntelligenceSignals: string[]
  videoEngagementScore: number | null
  sourcesUsed: string[]
}

export type GrowthVideoAutopilotRecommendation = {
  id: string
  leadId: string
  organizationId: string
  status: GrowthVideoAutopilotRecommendationStatus
  createdAt: string
  updatedAt: string
  approvedAt: string | null
  approvedBy: string | null
  dismissedAt: string | null
  dismissedBy: string | null
  shouldSendVideo: boolean
  videoType: GrowthVideoAutopilotVideoType
  scores: GrowthVideoAutopilotScores
  recommended: GrowthVideoAutopilotRecommendedAssets
  inputSnapshot: GrowthVideoAutopilotInputSnapshot
  aiPayload: Record<string, unknown> | null
  sourcesUsed: string[]
  requiresHumanReview: true
  autonomousExecutionEnabled: false
  outreachExecution: false
  enrollmentExecution: false
}

export type GrowthVideoAutopilotMetadata = {
  qa_marker: typeof GROWTH_VIDEO_AUTOPILOT_QA_MARKER
  recommendations: GrowthVideoAutopilotRecommendation[]
  activeRecommendationId: string | null
  requires_human_review: true
  autonomous_execution_enabled: false
  outreach_execution: false
  enrollment_execution: false
}

export type GrowthVideoAutopilotPreviewBundle = {
  recommendationId: string
  scriptPreview: string | null
  thumbnailPreviewDataUrl: string | null
  overlayPreviewHtml: string | null
  channelPreview: {
    emailHtml?: string | null
    smsText?: string | null
    voiceDropSummary?: string | null
  }
  voicePreviewAvailable: boolean
  avatarPreviewAvailable: boolean
  requiresHumanReview: true
  autonomousExecutionEnabled: false
}

export function growthVideoAutopilotSafetyPayload() {
  return {
    qa_marker: GROWTH_VIDEO_AUTOPILOT_QA_MARKER,
    requires_human_review: true as const,
    autonomous_execution_enabled: false as const,
    outreach_execution: false as const,
    enrollment_execution: false as const,
    orchestration_enabled: false as const,
  }
}
