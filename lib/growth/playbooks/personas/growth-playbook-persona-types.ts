/** GS-AI-PLAYBOOK-2E — Buyer persona messaging types (client-safe). */

import type { GrowthIndustryPlaybookBuyerPersona } from "@/lib/growth/playbooks/industry-playbook-types"
import type { GrowthPlaybookOutcomeGuidanceDiagnostics } from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-types"
import type { GrowthBuyingStageDiagnostics } from "@/lib/growth/buyer-journey/growth-buying-stage-types"

export const GROWTH_PLAYBOOK_PERSONA_MESSAGING_QA_MARKER =
  "growth-playbook-persona-messaging-gs-ai-playbook-2e-v1" as const

export type GrowthPersonaArchetype =
  | "owner"
  | "service_manager"
  | "htm_director"
  | "operations_director"
  | "dispatcher"
  | "compliance_manager"
  | "general"

export type GrowthPersonaLanguageStyle =
  | "executive"
  | "technical"
  | "operational"
  | "strategic"
  | "tactical"
  | "consultative"

export type GrowthPersonaMessageLengthPreference = "concise" | "moderate" | "detailed"

export type GrowthPersonaProofType =
  | "revenue_growth"
  | "profitability"
  | "labor_savings"
  | "compliance"
  | "audit_readiness"
  | "pm_completion"
  | "technician_productivity"
  | "reduced_callbacks"
  | "faster_scheduling"
  | "scalability"
  | "visibility"
  | "standardization"

export type GrowthPersonaCtaType =
  | "strategic_review"
  | "roi_discussion"
  | "workflow_walkthrough"
  | "compliance_review"
  | "operational_review"
  | "dispatch_demonstration"
  | "scalability_assessment"
  | "scheduling_walkthrough"
  | "consultative_discovery"

export type GrowthPersonaMessagingFramework = {
  persona: GrowthIndustryPlaybookBuyerPersona
  archetype: GrowthPersonaArchetype
  priorities: string[]
  fears: string[]
  desiredOutcomes: string[]
  buyingTriggers: string[]
  languageStyle: GrowthPersonaLanguageStyle
  messageLengthPreference: GrowthPersonaMessageLengthPreference
  preferredProofTypes: GrowthPersonaProofType[]
  preferredCtaTypes: GrowthPersonaCtaType[]
  avoidTopics: string[]
  openingStrategies: string[]
  recommendedMetrics: string[]
  urgencyDrivers: string[]
}

export type GrowthPersonaMessagingDiagnostics = {
  persona: string
  archetype: GrowthPersonaArchetype
  frameworkApplied: boolean
  preferredLanguage: GrowthPersonaLanguageStyle
  preferredProof: string
  preferredCta: string
  topicsAvoided: string[]
  confidence: "high" | "medium" | "low"
  matchReason: string | null
  /** GS-AI-PLAYBOOK-3C — outcome learning guidance diagnostics when applied. */
  outcomeGuidanceDiagnostics?: GrowthPlaybookOutcomeGuidanceDiagnostics | null
  /** GS-AI-PLAYBOOK-4A — buying stage guidance diagnostics when applied. */
  buyerJourneyDiagnostics?: GrowthBuyingStageDiagnostics | null
}

export type GrowthPersonaMessagingContext = {
  framework: GrowthPersonaMessagingFramework
  diagnostics: GrowthPersonaMessagingDiagnostics
  recommendedLanguageBlock: string
  preferredProofBlock: string
  preferredCtaBlock: string
  topicsToAvoidBlock: string
  personaFrameworkBlock: string
}

export type GrowthPersonaPromptSections = {
  buyerPersonaFramework: string
  recommendedLanguage: string
  preferredProof: string
  preferredCta: string
  topicsToAvoid: string
}
