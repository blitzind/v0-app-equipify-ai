/** Client-safe outreach personalization types (Growth Engine slice 6.15B). */

import type { GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"

export const OUTREACH_PERSONALIZATION_STRATEGY_VERSION = "6.15B-v1" as const

export const OUTREACH_PERSONALIZATION_DEFAULT_MAX_WORDS = 120 as const

export const OUTREACH_PERSONALIZATION_EMAIL_TYPES = [
  "cold_email",
  "follow_up_email",
  "reengagement_email",
  "executive_email",
  "breakup_email",
  "next_message",
  "response_draft",
] as const

export type OutreachPersonalizationEmailType = (typeof OUTREACH_PERSONALIZATION_EMAIL_TYPES)[number]

export const PERSONALIZATION_SIGNAL_KEYS = [
  "website_has_no_scheduler",
  "dispatch_appears_manual",
  "field_operations_signal",
  "technician_hiring_signal",
  "manual_process_signal",
  "capacity_growth_signal",
  "slow_response_signal",
  "recent_engagement_signal",
  "repeat_touch_signal",
  "high_fit_signal",
] as const

export type PersonalizationSignalKey = (typeof PERSONALIZATION_SIGNAL_KEYS)[number]

export const PERSONALIZATION_WARNING_CODES = [
  "missing_website_signal",
  "weak_personalization",
  "low_confidence_context",
  "missing_decision_maker",
] as const

export type PersonalizationWarningCode = (typeof PERSONALIZATION_WARNING_CODES)[number]

export type PersonalizationWarning = {
  code: PersonalizationWarningCode
  message: string
  severity: "info" | "warning" | "critical"
}

export const OUTREACH_INDUSTRY_KEYS = ["hvac", "medical_equipment", "field_service", "general"] as const
export type OutreachIndustryKey = (typeof OUTREACH_INDUSTRY_KEYS)[number]

export const MESSAGE_BLOCK_KEYS = ["pain", "industry", "proof", "cta", "opening"] as const
export type MessageBlockKey = (typeof MESSAGE_BLOCK_KEYS)[number]

export const MESSAGE_ANGLE_KEYS = [
  "dispatch_pain_capacity",
  "service_visibility_workflow",
  "field_ops_efficiency",
  "capacity_growth_ops",
  "engagement_follow_up",
  "executive_outcome",
  "breakup_respectful",
  "reply_response",
] as const

export type MessageAngleKey = (typeof MESSAGE_ANGLE_KEYS)[number]

export type ResearchOpenerSource =
  | "website_finding"
  | "outreach_angle"
  | "research_pain_point"
  | "company_summary"
  | "industry_context"

export type ResearchOpenerMetadata = {
  source: ResearchOpenerSource
  evidence: string
  confidenceTier: "high" | "medium"
}

export type OutreachContextPacket = {
  companyName: string
  industryLabel: string | null
  website: string | null
  employeeSize: string | null
  location: string | null
  decisionMakerName: string | null
  decisionMakerTitle: string | null
  fitScore: number | null
  engagementScore: number | null
  opportunityReadinessTier: string | null
  buyingIntent: string | null
  competitorPressure: string | null
  capacitySignals: string[]
  websiteFindings: string[]
  hiringSignals: string[]
  enrichmentFindings: string[]
  priorTouchSummaries: string[]
  priorReplySummaries: string[]
  objectionSummaries: string[]
  sequenceHistorySummaries: string[]
  timelineEventSummaries: string[]
  researchConfidence: number | null
  researchPainPoints: string[]
  equipmentServiceIndicators: string[]
  companySummary: string | null
  outreachAngles: string[]
  priorTouchCount: number
  hasWebsiteResearch: boolean
  hasDecisionMaker: boolean
  /** Sprint 3 — relationship memory influence */
  memoryAvailable: boolean
  memoryCoverageScore: number | null
  relationshipStage: string | null
  relationshipSummary: string | null
  memoryPreferenceSummaries: string[]
  memoryInteractionSummaries: string[]
  memoryCommitmentSummaries: string[]
  memoryAvoidRepeating: string[]
  memoryRiskFlags: string[]
}

export type SelectedMessageBlock = {
  key: MessageBlockKey
  blockId: string
  label: string
  text: string
}

export type SelectedMessageStrategy = {
  industry: OutreachIndustryKey
  angle: MessageAngleKey
  blocks: SelectedMessageBlock[]
  sourceSignals: PersonalizationSignalKey[]
  variationKey: string
  researchOpener?: ResearchOpenerMetadata
}

export type OutreachPersonalizationDraft = {
  subject: string
  body: string
  wordCount: number
}

export type OutreachPersonalizationAudit = {
  strategyVersion: typeof OUTREACH_PERSONALIZATION_STRATEGY_VERSION
  contextPacket: OutreachContextPacket
  selectedBlocks: SelectedMessageBlock[]
  angle: MessageAngleKey
  industry: OutreachIndustryKey
  sourceSignals: PersonalizationSignalKey[]
  warnings: PersonalizationWarning[]
  confidenceScore: number
  confidenceLabel: "low" | "medium" | "high"
  variationKey: string
  deterministicDraft: OutreachPersonalizationDraft
  refinedByAi: boolean
  generationType: GrowthAiCopilotGenerationType
  maxWords: number
}

export function isOutreachPersonalizationEmailType(
  generationType: GrowthAiCopilotGenerationType,
): generationType is OutreachPersonalizationEmailType {
  return (OUTREACH_PERSONALIZATION_EMAIL_TYPES as readonly string[]).includes(generationType)
}
