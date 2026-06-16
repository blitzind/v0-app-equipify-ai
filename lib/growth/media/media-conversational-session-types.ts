/** Growth Engine S2-H — conversational session lifecycle types (foundation only, no execution). */

import type { GrowthMediaConversationalAgentProvider } from "@/lib/growth/media/media-conversational-agent-types"
import type { GrowthMediaConversationalBookingCriteria } from "@/lib/growth/media/media-conversational-qualification-types"

export const GROWTH_MEDIA_CONVERSATIONAL_SESSION_QA_MARKER = "growth-media-conversational-session-s2h-v1" as const

export const GROWTH_MEDIA_CONVERSATIONAL_SESSION_STATUSES = [
  "draft",
  "ready",
  "active",
  "completed",
  "failed",
  "cancelled",
] as const

export type GrowthMediaConversationalSessionStatus =
  (typeof GROWTH_MEDIA_CONVERSATIONAL_SESSION_STATUSES)[number]

export const GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS = {
  provider_execution_enabled: false,
  autonomous_execution_enabled: false,
  no_conversation_execution: true,
  no_generated_media_assets: true,
  no_playback: true,
  no_notifications: true,
  no_sequence_execution: true,
} as const

export type GrowthMediaConversationalContext = {
  prospectName?: string | null
  companyName?: string | null
  senderName?: string | null
  senderCompany?: string | null
  qualificationGoal?: string | null
  systemPromptTemplate?: string | null
  customMergeValues?: Record<string, string>
}

export type GrowthMediaConversationalQualificationState = {
  qualificationId: string | null
  goal: string | null
  answeredQuestions: string[]
  missingRequiredAnswers: string[]
  disqualifiersTriggered: string[]
  fitScorePreview: number
  meetingReadinessPreview: number
  buyingCommitteeSignalPreview: "none" | "partial" | "strong"
  nextBestActionPreview: string | null
}

export type GrowthMediaConversationalMeetingRecommendation = {
  recommendBooking: boolean
  rationale: string
  suggestedAttendees: string[]
  readinessTier: "not_ready" | "warming" | "ready" | "high_intent"
}

export type GrowthMediaConversationalSessionRecord = {
  sessionId: string
  organizationId: string
  agentId: string | null
  provider: GrowthMediaConversationalAgentProvider
  status: GrowthMediaConversationalSessionStatus
  leadId: string | null
  sharePageId: string | null
  templateId: string | null
  conversationContext: GrowthMediaConversationalContext
  qualificationState: GrowthMediaConversationalQualificationState
  meetingRecommendation: GrowthMediaConversationalMeetingRecommendation
  transcript: string | null
  summary: string | null
  providerSessionId: string | null
  error: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthMediaConversationalSessionCreateInput = {
  organizationId: string
  agentId?: string | null
  leadId?: string | null
  sharePageId?: string | null
  templateId?: string | null
  qualificationGoal?: string | null
  systemPromptTemplate?: string | null
  conversationContext?: GrowthMediaConversationalContext
}

export type GrowthMediaConversationalPromptPreview = {
  systemPromptTemplate: string
  resolvedPrompt: string
  mergeFieldsUsed: string[]
  usedFallback: boolean
}

export type GrowthMediaConversationalQualificationPreview = {
  qualificationId: string | null
  goal: string | null
  questions: string[]
  requiredAnswers: string[]
  disqualifiers: string[]
  bookingCriteria: GrowthMediaConversationalBookingCriteria | null
  steps: Array<{ id: string; label: string; status: "pending" | "preview" }>
}
