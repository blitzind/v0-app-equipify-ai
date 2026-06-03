/** Client-safe Growth Engine AI copilot types. */

import type { OutreachPersonalizationAudit } from "@/lib/growth/outreach/personalization/personalization-types"

export const GROWTH_AI_COPILOT_GENERATION_TYPES = [
  "cold_email",
  "follow_up_email",
  "response_draft",
  "reengagement_email",
  "executive_email",
  "breakup_email",
  "call_opening",
  "call_objection_response",
  "call_summary",
  "next_message",
  "call_risk_brief",
] as const
export type GrowthAiCopilotGenerationType = (typeof GROWTH_AI_COPILOT_GENERATION_TYPES)[number]

export const GROWTH_AI_COPILOT_GENERATION_STATUSES = [
  "draft",
  "approved",
  "discarded",
  "expired",
] as const
export type GrowthAiCopilotGenerationStatus = (typeof GROWTH_AI_COPILOT_GENERATION_STATUSES)[number]

export const GROWTH_AI_COPILOT_EFFECTIVENESS_OUTCOMES = [
  "generated",
  "approved",
  "discarded",
  "expired",
] as const
export type GrowthAiCopilotEffectivenessOutcome =
  (typeof GROWTH_AI_COPILOT_EFFECTIVENESS_OUTCOMES)[number]

export const GROWTH_AI_COPILOT_REPLY_CLASSIFICATIONS = [
  "timing",
  "budget",
  "already_using_solution",
  "not_interested",
  "positive_interest",
  "referral",
  "question",
] as const
export type GrowthAiCopilotReplyClassification =
  (typeof GROWTH_AI_COPILOT_REPLY_CLASSIFICATIONS)[number]

export const GROWTH_AI_COPILOT_PROMPT_VARIANTS = ["default", "concise", "executive"] as const
export type GrowthAiCopilotPromptVariant = (typeof GROWTH_AI_COPILOT_PROMPT_VARIANTS)[number]

export const GROWTH_AI_COPILOT_PROMPT_VERSION = "6.0A-v1" as const

export type GrowthAiCopilotClassification = {
  primary?: GrowthAiCopilotReplyClassification | string
  secondary?: string[]
  sentiment?: "positive" | "neutral" | "negative"
  confidence?: number
  callPrep?: {
    decisionMakerFocus?: string
    knownBlockers?: string[]
    knownObjections?: string[]
    recommendedOpening?: string
    recommendedCta?: string
    riskSummary?: string
  }
  personalization?: OutreachPersonalizationAudit
}

export type GrowthAiCopilotGeneration = {
  id: string
  leadId: string
  generationType: GrowthAiCopilotGenerationType
  promptVersion: string
  promptVariant: GrowthAiCopilotPromptVariant | string
  inputSnapshot: Record<string, unknown>
  generatedContent: string
  generatedSubject: string | null
  classification: GrowthAiCopilotClassification
  status: GrowthAiCopilotGenerationStatus
  sourceReplyId: string | null
  inputHash: string | null
  playbookInfluenceScore: number
  playbookAttribution: Record<string, unknown>
  approvedAt: string | null
  approvedBy: string | null
  sentAt: string | null
  createdBy: string | null
  createdAt: string
}

export type GrowthAiCopilotEffectiveness = {
  id: string
  generationId: string
  leadId: string
  generationType: GrowthAiCopilotGenerationType
  promptVariant: string
  promptVersion: string
  outcome: GrowthAiCopilotEffectivenessOutcome
  classificationPrimary: string | null
  effectivenessScore: number
  metadata: Record<string, unknown>
  recordedAt: string
}

export type GrowthAiCopilotRule = {
  id: string
  ruleKey: string
  label: string
  description: string | null
  enabled: boolean
  ruleConfig: Record<string, unknown>
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type GrowthCopilotSettings = {
  id: string
  aiCopilotEnabled: boolean
  aiCopilotHumanApprovalRequired: boolean
  aiCopilotStoreGenerations: boolean
  aiCopilotGenerationRetentionDays: number
  aiCopilotDefaultPromptVariant: GrowthAiCopilotPromptVariant | string
  aiCopilotPlaybookEnabled: boolean
  aiCopilotPlaybookMaxRulesPerGeneration: number
  aiCopilotPlaybookSourceRetentionDays: number
  outreachPersonalizationEnabled: boolean
  outreachPersonalizationMaxWords: number
  callCopilotEnabled: boolean
  callCopilotRequireSummaryApproval: boolean
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthAiCopilotInputSnapshot = {
  companyName: string
  contactName: string | null
  fitScore: number | null
  engagementTier: string | null
  engagementSummary: string | null
  relationshipTier: string | null
  relationshipTrend: string | null
  opportunityTier: string | null
  opportunityBlockers: string[]
  opportunityAccelerators: string[]
  revenueTier: string | null
  revenueTrajectory: string | null
  executiveTier: string | null
  executiveRecommendation: string | null
  capacityTier: string | null
  capacityProtection: string | null
  researchSummary: string | null
  researchNextAction: string | null
  decisionMakers: Array<{ name: string; title: string | null; status: string | null }>
  nextBestAction: string | null
  nextBestActionReason: string | null
  recentOutbound: Array<{
    direction: "outbound" | "inbound"
    preview: string
    classification: string | null
    occurredAt: string | null
  }>
  replyPreview?: string | null
  growthSignalScore?: number | null
  growthSignalTier?: string | null
  growthSignalRecommendedAction?: string | null
  topGrowthSignals?: Array<{ signalType: string; confidence: number; evidence: string }>
  frameworks: {
    objections: string[]
    buyingSignals: string[]
    commitmentSignals: string[]
  }
  relationshipMemory?: {
    available: boolean
    memoryCoverageScore: number | null
    relationshipStage: string | null
    relationshipSummary: string | null
    engagementTrend: string | null
    topObjections: string[]
    topPreferences: string[]
    priorInteractions: string[]
    commitments: string[]
    avoidRepeatingTopics: string[]
    riskFlags: string[]
    committeeContext: string[]
  }
}
