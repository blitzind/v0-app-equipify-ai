/** GS-AI-PLAYBOOK-2D — Channel prompt optimization types (client-safe). */

export const GROWTH_PLAYBOOK_PROMPT_OPTIMIZATION_QA_MARKER =
  "growth-playbook-prompt-optimization-gs-ai-playbook-2d-v1" as const

export type GrowthPlaybookOptimizationChannel =
  | "EMAIL"
  | "SMS"
  | "VOICE"
  | "SHARE_PAGE"
  | "COPILOT"
  | "REFINEMENT"

export type GrowthPlaybookPromptBudgetTier =
  | "VERY_SMALL"
  | "SMALL"
  | "MEDIUM"
  | "LARGE"
  | "VERY_LARGE"

export type GrowthPlaybookPromptSectionPriority = "CRITICAL" | "IMPORTANT" | "OPTIONAL"

export type GrowthPlaybookPromptSectionKey =
  | "verified_company_facts"
  | "verified_company_summary"
  | "verified_operational_signals"
  | "verified_growth_signals"
  | "verified_technology_signals"
  | "verified_customer_signals"
  | "verified_differentiators"
  | "industry_intelligence"
  | "narrative_direction"
  | "buyer_persona"
  | "buyer_persona_framework"
  | "recommended_language"
  | "preferred_proof"
  | "preferred_cta"
  | "topics_to_avoid"
  | "recommended_tone"
  | "proof_points"
  | "cta_guidance"
  | "objection_awareness"
  | "context_weighting"
  | "emphasize"
  | "avoid"

export type GrowthPlaybookOrchestratedSections = Record<GrowthPlaybookPromptSectionKey, string> & {
  header: string
  vocabulary?: string
  regenerationBlock?: string
}

export type GrowthPlaybookPromptOptimizationStrategy =
  | "channel_defaults"
  | "budget_trim"
  | "full_context"

export type GrowthPlaybookPromptOptimizationDiagnostics = {
  channel: GrowthPlaybookOptimizationChannel
  budgetTier: GrowthPlaybookPromptBudgetTier
  estimatedPromptSize: number
  budgetLimit: number
  sectionsIncluded: GrowthPlaybookPromptSectionKey[]
  sectionsTrimmed: GrowthPlaybookPromptSectionKey[]
  sectionsOmitted: GrowthPlaybookPromptSectionKey[]
  budgetUtilization: number
  optimizationStrategy: GrowthPlaybookPromptOptimizationStrategy
  weightingPreserved: boolean
}

export type GrowthPlaybookOptimizedPromptResult = {
  optimizedPrompt: string
  includedSections: GrowthPlaybookPromptSectionKey[]
  omittedSections: GrowthPlaybookPromptSectionKey[]
  budgetUtilization: number
  diagnostics: GrowthPlaybookPromptOptimizationDiagnostics
}
