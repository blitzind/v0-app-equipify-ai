/** GS-AI-PLAYBOOK-1C/2B — Unified industry context types (client-safe). */

import type { GrowthIndustryId } from "@/lib/growth/playbooks/industry-taxonomy"
import type { GrowthIndustryPlaybook } from "@/lib/growth/playbooks/industry-playbook-types"
import type { GrowthPlaybookContext } from "@/lib/growth/playbooks/context/growth-playbook-context-types"
import type { GrowthNarrativeContext } from "@/lib/growth/playbooks/narrative/growth-playbook-narrative-types"
import type { GrowthPersonaMessagingContext } from "@/lib/growth/playbooks/personas/growth-playbook-persona-types"
import type { GrowthAccountIntelligenceContext, GrowthAccountIntelligenceInput } from "@/lib/growth/account-intelligence/growth-account-intelligence-types"
import type { GrowthPlaybookOutcomeGuidanceContext } from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-types"
import type { GrowthPlaybookOutcomeRecord } from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-types"
import type { GrowthBuyingStageContext } from "@/lib/growth/buyer-journey/growth-buying-stage-types"
import type { GrowthBuyingStageSignalInput } from "@/lib/growth/buyer-journey/growth-buying-stage-signals"
import type { GrowthPersonalizationRegenerationFeedbackCategory } from "@/lib/growth/personalization/personalization-types"
import type { GrowthReasoningContext } from "@/lib/growth/reasoning/growth-reasoning-types"
import type { GrowthSequenceIntelligenceContext } from "@/lib/growth/sequence-intelligence/growth-sequence-state-types"

export const GROWTH_INDUSTRY_CONTEXT_QA_MARKER = "growth-industry-context-gs-ai-playbook-1c-v1" as const

export const GROWTH_INDUSTRY_CONTEXT_MIN_CONFIDENCE = 56

export type GrowthIndustryContextRegenerationFeedback = {
  category: GrowthPersonalizationRegenerationFeedbackCategory
  customNotes?: string | null
  priorGenerationId?: string | null
  recordedAt?: string | null
}

export type GrowthIndustryContext = {
  industryId: GrowthIndustryId | null
  confidence: number
  playbook: GrowthIndustryPlaybook | null
  /** GS-AI-PLAYBOOK-2B — deterministic playbook selection output. */
  playbookContext: GrowthPlaybookContext | null
  /** GS-AI-PLAYBOOK-2C — narrative intelligence for prompt orchestration. */
  narrativeContext: GrowthNarrativeContext | null
  /** GS-AI-PLAYBOOK-2E — persona-first messaging framework. */
  personaMessagingContext: GrowthPersonaMessagingContext | null
  /** GS-AI-PLAYBOOK-3A — verified account intelligence enrichment. */
  accountIntelligenceContext: GrowthAccountIntelligenceContext | null
  /** GS-AI-PLAYBOOK-3C — outcome learning adaptive guidance. */
  outcomeGuidanceContext: GrowthPlaybookOutcomeGuidanceContext | null
  /** GS-AI-PLAYBOOK-4A — buying stage & conversation state intelligence. */
  buyerJourneyContext: GrowthBuyingStageContext | null
  /** GS-AI-PLAYBOOK-4B — deterministic reasoning & message planning layer. */
  reasoningContext?: GrowthReasoningContext | null
  /** GS-AI-PLAYBOOK-4C — multi-touch sequence intelligence layer. */
  sequenceIntelligenceContext?: GrowthSequenceIntelligenceContext | null
  verifiedFacts: string[]
  industryFacts: string[]
  capabilityMappings: Array<{
    capability: string
    painSignal: string
    equipifyModule: string
    industryFraming: string
  }>
  discoveryQuestions: string[]
  videoStorylines: Array<{ title: string; hook: string; audience: string }>
  recommendedCtas: string[]
  regenerationFeedback: GrowthIndustryContextRegenerationFeedback | null
  leadIndustryTags: string[]
  playbookApplied: boolean
}

export type GrowthIndustryContextInput = {
  companyName?: string | null
  industryLabel?: string | null
  description?: string | null
  websiteText?: string | null
  researchSummary?: string | null
  naics?: string | string[] | null
  sic?: string | string[] | null
  verifiedFacts?: string[]
  regenerationFeedback?: GrowthIndustryContextRegenerationFeedback | null
  /** GS-AI-PLAYBOOK-2B — optional signals for deterministic playbook selection. */
  leadSignals?: string[]
  researchSignals?: string[]
  hiringSignals?: string[]
  websiteSignals?: string[]
  evidenceLabels?: string[]
  companySize?: string | null
  decisionMakerTitle?: string | null
  /** GS-AI-PLAYBOOK-3A — optional structured enrichment for account intelligence. */
  accountIntelligence?: Omit<
    GrowthAccountIntelligenceInput,
    "companyName" | "companySummary" | "websiteSummary" | "verifiedFacts" | "companySize" | "decisionMakerTitle"
  >
  /** GS-AI-PLAYBOOK-3C — optional outcome records for adaptive guidance. */
  outcomeRecords?: GrowthPlaybookOutcomeRecord[]
  /** GS-AI-PLAYBOOK-4A — optional buyer journey signals. */
  buyerJourneySignals?: GrowthBuyingStageSignalInput
}
