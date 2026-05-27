/** Calendar event intelligence types (Sprint 3.2). Client-safe. */

import type { MeetingPrepRiskPriority } from "@/lib/growth/meeting-intelligence/meeting-prep-types"

export const GROWTH_CALENDAR_INTELLIGENCE_QA_MARKER = "growth-calendar-intelligence-v1" as const

export const CALENDAR_FOLLOW_UP_RISK_PRIORITIES = ["Critical", "High", "Medium", "Low"] as const
export type CalendarFollowUpRiskPriority = (typeof CALENDAR_FOLLOW_UP_RISK_PRIORITIES)[number]

export const CALENDAR_RISK_LEVELS = ["critical", "high", "medium", "low"] as const
export type CalendarRiskLevel = (typeof CALENDAR_RISK_LEVELS)[number]

export type CalendarFollowUpRisk = {
  id: string
  label: string
  priority: CalendarFollowUpRiskPriority
  reason: string
  source: string
}

export type CalendarSuggestedNextAction = {
  action: string
  reasons: string[]
  evidence: string[]
}

export type GrowthCalendarEventIntelligence = {
  qa_marker: typeof GROWTH_CALENDAR_INTELLIGENCE_QA_MARKER
  meetingId: string
  leadId: string
  leadScore: number | null
  leadScoreLabel: string | null
  buyingStage: string | null
  meetingReadiness: number
  meetingReadinessLabel: string
  decisionMakerCount: number
  committeeCoveragePct: number | null
  topObjective: string | null
  topRisk: string | null
  topRiskPriority: MeetingPrepRiskPriority | null
  followUpRisks: CalendarFollowUpRisk[]
  suggestedNextAction: CalendarSuggestedNextAction | null
  riskLevel: CalendarRiskLevel
  calendarAttached: boolean
  prepAvailable: boolean
}

export type GrowthCalendarIntelligenceFeed = {
  qa_marker: typeof GROWTH_CALENDAR_INTELLIGENCE_QA_MARKER
  items: GrowthCalendarEventIntelligence[]
}
