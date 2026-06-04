/** Client-safe SMS personalization types (Phase 5.3). */

import type {
  CtaIntelligenceMetadata,
  MemoryOpenerMetadata,
  MemoryQualityMetadata,
  OutreachContextPacket,
  OutreachContextQualityMetadata,
  PersonalizationSignalKey,
  PersonalizationWarning,
  ResearchOpenerMetadata,
} from "@/lib/growth/outreach/personalization/personalization-types"
import { GROWTH_SMS_PERSONALIZATION_QA_MARKER } from "@/lib/growth/sms/personalization/sms-personalization-audit"

export { GROWTH_SMS_PERSONALIZATION_QA_MARKER }

export const SMS_PERSONALIZATION_STRATEGY_VERSION = "5.3-v1" as const

export const SMS_PERSONALIZATION_DEFAULT_MAX_CHARS = 320 as const

export const SMS_MESSAGE_TYPES = [
  "cold_sms",
  "follow_up_sms",
  "sms_reply",
  "customer_check_in_sms",
  "reengagement_sms",
] as const
export type SmsMessageType = (typeof SMS_MESSAGE_TYPES)[number]

export const SMS_OPENING_HOOK_STRATEGIES = [
  "research_question",
  "pain_question",
  "memory_continuation",
  "follow_up_question",
  "customer_check_in",
  "generic_question",
] as const
export type SmsOpeningHookStrategy = (typeof SMS_OPENING_HOOK_STRATEGIES)[number]

export const SMS_CTA_CATEGORIES = [
  "quick_question",
  "yes_no",
  "clarification",
  "scheduling_prompt",
  "commitment_continuation",
  "soft_reply",
] as const
export type SmsCtaCategory = (typeof SMS_CTA_CATEGORIES)[number]

export type SmsPersonalizationContext = {
  packet: OutreachContextPacket
  priorSmsPreviews: string[]
  priorSmsCount: number
  shortForm: true
}

export type SmsOpeningHookMetadata = {
  strategy: SmsOpeningHookStrategy
  evidence: string | null
  evidenceSource: string | null
  researchOpener?: ResearchOpenerMetadata
  memoryOpener?: MemoryOpenerMetadata
}

export type SmsCtaMetadata = {
  category: SmsCtaCategory
  evidence: string | null
  evidenceSource: string | null
  selectionReason: string
  ctaIntelligence?: Pick<CtaIntelligenceMetadata, "category" | "evidenceSource" | "qualityScore">
}

export type SmsQualityScore = {
  overall: number
  specificity: number
  conversationalTone: number
  charFit: number
  nonGeneric: number
  memoryAlignment: number
  contextAlignment: number
}

export type SmsPersonalizationDraft = {
  body: string
  charCount: number
  segmentCount: number
}

export type SmsPersonalizationAudit = {
  strategyVersion: typeof SMS_PERSONALIZATION_STRATEGY_VERSION
  messageType: SmsMessageType
  context: SmsPersonalizationContext
  openingHook: SmsOpeningHookMetadata
  cta: SmsCtaMetadata
  sourceSignals: PersonalizationSignalKey[]
  warnings: PersonalizationWarning[]
  confidenceScore: number
  confidenceLabel: "low" | "medium" | "high"
  variationKey: string
  deterministicDraft: SmsPersonalizationDraft
  maxChars: number
  contextQuality?: OutreachContextQualityMetadata
  memoryQuality?: MemoryQualityMetadata
  qualityScore: SmsQualityScore
}

export type GrowthSmsInboxDraftSuggestion = {
  qa_marker: typeof GROWTH_SMS_PERSONALIZATION_QA_MARKER
  channel: "sms"
  draftType: "outbound" | "reply"
  suggestedBody: string
  charCount: number
  segmentCount: number
  humanApprovalRequired: true
  audit: Pick<
    SmsPersonalizationAudit,
    "openingHook" | "cta" | "qualityScore" | "contextQuality" | "memoryQuality" | "confidenceLabel"
  >
  contextUsed: string[]
  memoryUsed: string[]
}
