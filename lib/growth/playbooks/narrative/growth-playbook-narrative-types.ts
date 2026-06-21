/** GS-AI-PLAYBOOK-2C — Narrative intelligence types (client-safe). */

import type { GrowthIndustryPlaybookBuyerPersona } from "@/lib/growth/playbooks/industry-playbook-types"
import type { GrowthPlaybookSelectionTheme } from "@/lib/growth/playbooks/context/growth-playbook-context-types"
import type { GrowthPlaybookPromptOptimizationDiagnostics } from "@/lib/growth/playbooks/prompt-optimization/growth-playbook-prompt-optimization-types"
import type { GrowthPersonaMessagingDiagnostics } from "@/lib/growth/playbooks/personas/growth-playbook-persona-types"
import type { GrowthAccountIntelligenceDiagnostics } from "@/lib/growth/account-intelligence/growth-account-intelligence-types"
import type { GrowthPlaybookOutcomeGuidanceDiagnostics } from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-types"
import type { GrowthBuyingStageDiagnostics } from "@/lib/growth/buyer-journey/growth-buying-stage-types"

export const GROWTH_PLAYBOOK_NARRATIVE_QA_MARKER = "growth-playbook-narrative-gs-ai-playbook-2c-v1" as const

export type GrowthNarrativeType =
  | "workflow"
  | "compliance"
  | "scaling"
  | "financial"
  | "operational_complexity"
  | "growth"
  | "general"

export type GrowthNarrativeTone =
  | "educational"
  | "consultative"
  | "advisory"
  | "direct"
  | "executive"
  | "technical"
  | "operational"

export type GrowthNarrativeLeadWith =
  | "operational_pain"
  | "financial_pain"
  | "customer_experience"
  | "growth_pain"
  | "compliance"

export type GrowthNarrativeCompanyVsIndustryRatio = {
  companyPercent: number
  industryPercent: number
  rationale: string
}

export type GrowthNarrativeObjectionAwareness = {
  objection: string
  recommendedResponse: string
  recommendedDiscoveryQuestion: string
}

export type GrowthNarrativeContext = {
  primaryNarrative: string
  secondaryNarrative: string
  narrativeType: GrowthNarrativeType
  buyerPersona: GrowthIndustryPlaybookBuyerPersona | null
  secondaryBuyerPersona: GrowthIndustryPlaybookBuyerPersona | null
  leadWith: GrowthNarrativeLeadWith
  recommendedTone: GrowthNarrativeTone
  narrativeGoals: string[]
  recommendedOpening: string
  recommendedProof: string | null
  recommendedCTA: string | null
  objectionAwareness: GrowthNarrativeObjectionAwareness[]
  companyVsIndustryRatio: GrowthNarrativeCompanyVsIndustryRatio
  activeThemes: GrowthPlaybookSelectionTheme[]
}

export type GrowthNarrativeContextInput = {
  verifiedFacts?: string[]
  playbookDisplayName?: string | null
  activeThemes?: GrowthPlaybookSelectionTheme[]
  selectedPains?: string[]
  selectedCapabilities?: Array<{ capability: string; painSignal: string; equipifyModule: string }>
  primaryPersona?: GrowthIndustryPlaybookBuyerPersona | null
  secondaryPersona?: GrowthIndustryPlaybookBuyerPersona | null
  primaryCta?: string | null
  selectedObjections?: GrowthNarrativeObjectionAwareness[]
  decisionMakerTitle?: string | null
  leadSignals?: string[]
}

export type GrowthPlaybookPromptChannel = "email" | "sms" | "voice" | "page" | "copilot"

export type GrowthPlaybookOrchestratedPrompt = {
  verifiedCompanyFacts: string
  /** GS-AI-PLAYBOOK-3A — verified account intelligence sections. */
  verifiedCompanySummary: string
  verifiedOperationalSignals: string
  verifiedGrowthSignals: string
  verifiedTechnologySignals: string
  verifiedCustomerSignals: string
  verifiedDifferentiators: string
  industryIntelligence: string
  narrativeDirection: string
  /** @deprecated Legacy thin persona block — prefer buyerPersonaFramework when present. */
  buyerPersona: string
  /** GS-AI-PLAYBOOK-2E — persona-first framework block. */
  buyerPersonaFramework: string
  recommendedLanguage: string
  preferredProof: string
  preferredCta: string
  topicsToAvoid: string
  recommendedTone: string
  proofPoints: string
  ctaGuidance: string
  objectionAwareness: string
  weightingInstructions: string
  emphasize: string[]
  avoid: string[]
  formattedBlock: string
  /** GS-AI-PLAYBOOK-2D — channel optimization diagnostics when applied. */
  promptOptimization?: GrowthPlaybookPromptOptimizationDiagnostics
  /** GS-AI-PLAYBOOK-2E — persona framework diagnostics. */
  personaDiagnostics?: GrowthPersonaMessagingDiagnostics
  /** GS-AI-PLAYBOOK-3A — account intelligence diagnostics. */
  accountIntelligenceDiagnostics?: GrowthAccountIntelligenceDiagnostics
  /** GS-AI-PLAYBOOK-3C — outcome learning guidance diagnostics. */
  outcomeGuidanceDiagnostics?: GrowthPlaybookOutcomeGuidanceDiagnostics
  /** GS-AI-PLAYBOOK-4A — buying stage guidance diagnostics. */
  buyerJourneyDiagnostics?: GrowthBuyingStageDiagnostics
  /** GS-AI-PLAYBOOK-4B — reasoning & planning diagnostics. */
  reasoningDiagnostics?: import("@/lib/growth/reasoning/growth-reasoning-types").GrowthReasoningDiagnostics
  /** GS-AI-PLAYBOOK-4C — sequence intelligence diagnostics. */
  sequenceDiagnostics?: import("@/lib/growth/sequence-intelligence/growth-sequence-state-types").GrowthSequenceDiagnostics
}
