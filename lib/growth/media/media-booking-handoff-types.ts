/** Growth Engine S2-J — booking handoff lifecycle types (foundation only, no calendar execution). */

import type { GrowthMediaMeetingReadinessSnapshot, GrowthMediaMeetingReadinessTier } from "@/lib/growth/media/media-meeting-readiness-types"

export const GROWTH_MEDIA_BOOKING_HANDOFF_QA_MARKER = "growth-media-booking-handoff-s2j-v1" as const

export const GROWTH_MEDIA_BOOKING_HANDOFF_STATUSES = [
  "draft",
  "ready",
  "booked",
  "cancelled",
  "archived",
] as const

export type GrowthMediaBookingHandoffStatus = (typeof GROWTH_MEDIA_BOOKING_HANDOFF_STATUSES)[number]

export const GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS = {
  calendar_execution_enabled: false,
  booking_execution_enabled: false,
  no_calendar_creation: true,
  no_notifications: true,
  no_sequence_execution: true,
  requires_human_review: true,
} as const

export type GrowthMediaBookingHandoffSignal = {
  key: string
  label: string
  strength: "low" | "medium" | "high"
}

export type GrowthMediaBookingHandoffRecommendationRule = {
  ruleId: string
  qualificationGoal: string
  readinessTier: GrowthMediaMeetingReadinessTier
  recommendedMeetingType: string
  recommendedDurationMinutes: number
  recommendedAttendees: string[]
  recommendedOwner: string
  agendaTemplate: string
  nextSteps: string[]
}

export type GrowthMediaBookingHandoffRecord = {
  handoffId: string
  organizationId: string
  leadId?: string | null
  sharePageId?: string | null
  status: GrowthMediaBookingHandoffStatus
  readinessTier: GrowthMediaMeetingReadinessTier
  readinessScore: number
  qualificationGoal: string | null
  recommendedMeetingType: string
  recommendedDurationMinutes: number
  recommendedAttendees: string[]
  recommendedOwner: string
  recommendedAgenda: string
  recommendedNextSteps: string[]
  bookingRecommendation: string
  signals: GrowthMediaBookingHandoffSignal[]
  rationale: string
  requiresHumanReview: boolean
  meetingReadiness: GrowthMediaMeetingReadinessSnapshot
  createdAt: string
  updatedAt: string
}

export type GrowthMediaBookingHandoffCreateInput = {
  organizationId: string
  leadId?: string | null
  sharePageId?: string | null
  qualificationGoal?: string | null
  prospectName?: string | null
  companyName?: string | null
  senderName?: string | null
  senderCompany?: string | null
  aiQaEnabled?: boolean
  conversationEnabled?: boolean
  bookingHandoffEnabled?: boolean
  agendaTemplate?: string | null
}

export type GrowthMediaBookingHandoffPreview = {
  readiness: GrowthMediaMeetingReadinessSnapshot
  recommendation: Pick<
    GrowthMediaBookingHandoffRecord,
    | "recommendedMeetingType"
    | "recommendedDurationMinutes"
    | "recommendedAttendees"
    | "recommendedOwner"
    | "recommendedAgenda"
    | "recommendedNextSteps"
    | "bookingRecommendation"
    | "signals"
    | "rationale"
    | "requiresHumanReview"
  >
}
