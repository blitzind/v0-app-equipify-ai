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
  | "website_summary"
  | "outreach_angle"
  | "lead_engine_angle"
  | "lead_engine_pain"
  | "research_pain_point"
  | "company_summary"
  | "industry_context"

export type ResearchOpenerMetadata = {
  source: ResearchOpenerSource
  evidence: string
  confidenceTier: "high" | "medium"
}

export type MemoryOpenerSource =
  | "memory_commitment"
  | "memory_interaction"
  | "memory_open_loop"
  | "memory_objection"
  | "memory_preference"
  | "relationship_summary"
  | "relationship_stage"

export type MemoryOpenerMetadata = {
  source: MemoryOpenerSource
  evidence: string
}

export const OUTREACH_MEMORY_SIGNAL_KEYS = [
  "relationship_stage",
  "relationship_summary",
  "memory_coverage",
  "commitments",
  "prior_interactions",
  "preferences",
  "objections",
  "avoid_repeating",
  "risk_flags",
  "committee_context",
  "engagement_trend",
  "progression_score",
  "open_loops",
] as const

export type MemorySignalKey = (typeof OUTREACH_MEMORY_SIGNAL_KEYS)[number]

export type MemoryCommunicationStyle = {
  maxWordsOverride?: number
  preferShortSentences: boolean
  formality: "standard" | "executive" | "relationship"
  omitProofBlock: boolean
  applied: boolean
}

export type MemoryInfluenceMetadata = {
  painInfluenced: boolean
  objectionAware: boolean
  styleApplied: boolean
  avoidedTopics: string[]
  committeeReferenced: boolean
}

export type MemoryQualityMetadata = {
  memorySignalsAvailable: MemorySignalKey[]
  memorySignalsUsed: MemorySignalKey[]
  memoryUtilizationPercentage: number
}

export type SubjectCategory =
  | "research_observation"
  | "pain_point"
  | "curiosity"
  | "follow_up"
  | "memory_aware"
  | "legacy_fallback"

export type SubjectEvidenceSource =
  | ResearchOpenerSource
  | "memory_commitment"
  | "memory_interaction"
  | "memory_objection"
  | "memory_open_loop"
  | "memory_preference"
  | "relationship_stage"
  | "relationship_summary"
  | "pain_signal"
  | "industry_signal"
  | "sequence_context"
  | "legacy_template"

export type SubjectQualityScore = {
  overall: number
  specificity: number
  relevance: number
  nonGeneric: number
  length: number
  curiosity: number
  diversity: number
  isGenericPattern: boolean
}

export type SubjectIntelligenceMetadata = {
  category: SubjectCategory
  evidenceSource: SubjectEvidenceSource
  evidence: string | null
  qualityScore: SubjectQualityScore
  legacySubject: string
}

export type CtaCategory =
  | "question_based"
  | "soft"
  | "meeting"
  | "direct"
  | "follow_up"
  | "memory_aware"

export type CtaEvidenceSource =
  | "research_confidence"
  | "memory_commitment"
  | "memory_interaction"
  | "memory_preference"
  | "memory_objection"
  | "relationship_stage"
  | "prior_reply"
  | "booking_signal"
  | "opportunity_signal"
  | "sequence_stage"
  | "engagement_signal"
  | "pain_signal"
  | "lead_engine_guidance"
  | "legacy_template"
  | "breakup_context"

export const OUTREACH_CONTEXT_SOURCE_KEYS = [
  "company_name",
  "industry_label",
  "website",
  "location",
  "decision_maker",
  "fit_score",
  "engagement_score",
  "website_summary",
  "website_text_excerpt",
  "website_findings",
  "outreach_angles",
  "company_summary",
  "research_pain_points",
  "hiring_signals",
  "timeline_events",
  "sequence_history",
  "prior_touches",
  "prior_replies",
  "prior_subjects",
  "memory",
  "lead_engine_guidance",
  "enrichment_findings",
  "equipment_indicators",
  "competitor_pressure",
  "capacity_signals",
  "research_confidence",
  "research_recommended_next_action",
] as const

export type OutreachContextSourceKey = (typeof OUTREACH_CONTEXT_SOURCE_KEYS)[number]

export type OutreachLeadEngineGuidance = {
  personalizationSummary: string
  companyContext: string | null
  contactContext: string | null
  prioritizedPainPoints: string[]
  prioritizedOutreachAngles: string[]
  communicationGuidance: string[]
  buyingSignalGuidance: string[]
  recommendedCtaStrategy: string | null
  recommendedChannelPriority: string[]
  recommendedSequencePriority: string | null
  confidence: number | null
  completeness: number | null
}

export type OutreachContextQualityMetadata = {
  contextSourcesAvailable: OutreachContextSourceKey[]
  contextSourcesUsed: OutreachContextSourceKey[]
  utilizationPercentage: number
}

export type CtaQualityScore = {
  overall: number
  replyFit: number
  contextMatch: number
  specificity: number
  engagementAlignment: number
  memoryAlignment: number
  avoidsColdMeetingAsk: boolean
}

export type CtaIntelligenceMetadata = {
  category: CtaCategory
  evidenceSource: CtaEvidenceSource
  evidence: string | null
  selectionReason: string
  qualityScore: CtaQualityScore
  legacyCta: string
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
  websiteSummary: string | null
  websiteTextExcerpt: string | null
  websiteFindings: string[]
  hiringSignals: string[]
  enrichmentFindings: string[]
  researchRecommendedNextAction: string | null
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
  priorOutboundSubjects: string[]
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
  memoryCommitteeSummaries: string[]
  memoryOpenLoopSummaries: string[]
  memoryEngagementTrend: string | null
  memoryProgressionScore: number | null
  memoryUnresolvedObjectionCount: number
  /** Read-only Lead Engine advisory guidance (Phase 4.4D). */
  leadEngineGuidance: OutreachLeadEngineGuidance | null
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
  memoryOpener?: MemoryOpenerMetadata
  memoryInfluence?: MemoryInfluenceMetadata
  communicationStyle?: MemoryCommunicationStyle
  subjectIntelligence?: SubjectIntelligenceMetadata
  ctaIntelligence?: CtaIntelligenceMetadata
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
  subjectIntelligence?: SubjectIntelligenceMetadata
  ctaIntelligence?: CtaIntelligenceMetadata
  contextQuality?: OutreachContextQualityMetadata
  memoryQuality?: MemoryQualityMetadata
}

export function isOutreachPersonalizationEmailType(
  generationType: GrowthAiCopilotGenerationType,
): generationType is OutreachPersonalizationEmailType {
  return (OUTREACH_PERSONALIZATION_EMAIL_TYPES as readonly string[]).includes(generationType)
}
