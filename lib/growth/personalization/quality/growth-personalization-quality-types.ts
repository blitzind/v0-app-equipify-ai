/** GS-AI-PLAYBOOK-3B — Personalization quality types (client-safe). */

export const GROWTH_PERSONALIZATION_QUALITY_QA_MARKER =
  "growth-personalization-quality-gs-ai-playbook-3b-v1" as const

export type GrowthPersonalizationQualityChannel = "EMAIL" | "SMS" | "VOICE" | "VIDEO" | "SHARE_PAGE"

export type GrowthPersonalizationQualityDimension =
  | "specificity"
  | "consultativeTone"
  | "credibility"
  | "personalization"
  | "clarity"
  | "conciseness"
  | "flow"
  | "ctaQuality"
  | "humanTone"
  | "evidenceUsage"

export type GrowthPersonalizationQualityIssueType =
  | "generic_opening"
  | "generic_pain"
  | "too_salesy"
  | "feature_dump"
  | "weak_cta"
  | "repetitive_language"
  | "ai_sounding_phrases"
  | "unsupported_claim"
  | "paragraph_length"
  | "poor_sequence"

export type GrowthPersonalizationQualityDimensionScores = Record<GrowthPersonalizationQualityDimension, number>

export type GrowthPersonalizationQualityDiagnostics = {
  overallQualityScore: number
  dimensionScores: GrowthPersonalizationQualityDimensionScores
  issuesDetected: GrowthPersonalizationQualityIssueType[]
  rewritesApplied: string[]
  suggestions: string[]
  strengths: string[]
  /** GS-AI-PLAYBOOK-4A — buying stage context attached when available. */
  buyerJourneyDiagnostics?: import("@/lib/growth/buyer-journey/growth-buying-stage-types").GrowthBuyingStageDiagnostics | null
  /** GS-AI-PLAYBOOK-4B — reasoning & planning diagnostics when available. */
  reasoningDiagnostics?: import("@/lib/growth/reasoning/growth-reasoning-types").GrowthReasoningDiagnostics | null
  /** GS-AI-PLAYBOOK-4C — sequence intelligence diagnostics when available. */
  sequenceDiagnostics?: import("@/lib/growth/sequence-intelligence/growth-sequence-state-types").GrowthSequenceDiagnostics | null
}

export type GrowthPersonalizationQualityInput = {
  channel: GrowthPersonalizationQualityChannel
  subject?: string | null
  body: string
  companyName?: string | null
  contactName?: string | null
  allowedFacts?: string[]
  industryLabel?: string | null
  industryFact?: string | null
  preferredCta?: string | null
  maxWords?: number
  maxChars?: number
  skipRewrite?: boolean
}

export type GrowthPersonalizationQualityResult = {
  subject: string | null
  body: string
  diagnostics: GrowthPersonalizationQualityDiagnostics
  qualityApplied: boolean
}

export type GrowthPersonalizationSharePageQualityInput = {
  headline: string
  heroMessage: string
  whyReachingOut: string
  ctaLabel: string
  companyName?: string | null
  allowedFacts?: string[]
}

export type GrowthPersonalizationVideoScriptQualityInput = {
  script: string
  companyName?: string | null
  allowedFacts?: string[]
}
