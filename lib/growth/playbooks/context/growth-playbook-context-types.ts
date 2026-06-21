/** GS-AI-PLAYBOOK-2B — Playbook context selection types (client-safe). */

import type { GrowthIndustryId } from "@/lib/growth/playbooks/industry-taxonomy"
import type {
  GrowthIndustryPlaybook,
  GrowthIndustryPlaybookBuyerPersona,
  GrowthIndustryPlaybookCapabilityMapping,
  GrowthIndustryPlaybookStoryline,
  GrowthIndustryPlaybookStructuredObjection,
} from "@/lib/growth/playbooks/industry-playbook-types"
import type { GrowthIndustryContextRegenerationFeedback } from "@/lib/growth/playbooks/growth-industry-context-types"

export const GROWTH_PLAYBOOK_CONTEXT_QA_MARKER = "growth-playbook-context-gs-ai-playbook-2b-v1" as const

export type GrowthPlaybookSelectionTheme =
  | "pm"
  | "compliance"
  | "dispatch"
  | "scaling"
  | "financial"
  | "growth"
  | "general"

export type GrowthPlaybookContextInput = {
  playbook: GrowthIndustryPlaybook
  industryId: GrowthIndustryId
  verifiedFacts?: string[]
  leadSignals?: string[]
  researchSignals?: string[]
  hiringSignals?: string[]
  websiteSignals?: string[]
  evidenceLabels?: string[]
  companySize?: string | null
  decisionMakerTitle?: string | null
  regenerationFeedback?: GrowthIndustryContextRegenerationFeedback | null
}

export type GrowthPlaybookRankedCta = {
  cta: string
  rank: "primary" | "secondary" | "tertiary"
  style: "consultative" | "workflow" | "demo" | "general"
}

export type GrowthPlaybookRankedStoryline = {
  storyline: GrowthIndustryPlaybookStoryline
  category: "operational" | "financial" | "growth"
}

export type GrowthPlaybookContext = {
  industryId: GrowthIndustryId
  playbookDisplayName: string
  enrichmentLevel: GrowthIndustryPlaybook["enrichmentLevel"]
  activeThemes: GrowthPlaybookSelectionTheme[]
  selectedPains: string[]
  selectedDiscoveryQuestions: string[]
  selectedCtas: string[]
  selectedStorylines: GrowthIndustryPlaybookStoryline[]
  selectedCapabilities: GrowthIndustryPlaybookCapabilityMapping[]
  selectedObjections: GrowthIndustryPlaybookStructuredObjection[]
  selectedBuyerPersonas: GrowthIndustryPlaybookBuyerPersona[]
  selectedSignals: string[]
  selectedVocabulary: string[]
  selectedTriggers: string[]
  primaryPersona: GrowthIndustryPlaybookBuyerPersona | null
  secondaryPersona: GrowthIndustryPlaybookBuyerPersona | null
  primaryCta: string | null
  secondaryCta: string | null
  tertiaryCta: string | null
  rankedCtas: GrowthPlaybookRankedCta[]
  rankedStorylines: GrowthPlaybookRankedStoryline[]
  selectionDiagnostics: {
    signalHaystackTerms: string[]
    matchedThemes: GrowthPlaybookSelectionTheme[]
    personaSelectionReason: string | null
  }
}
