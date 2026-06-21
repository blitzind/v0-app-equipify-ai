/** GS-AI-PLAYBOOK-4B — Multi-step reasoning types (client-safe). */

export const GROWTH_REASONING_QA_MARKER = "growth-reasoning-gs-ai-playbook-4b-v1" as const

export type GrowthReasoningChannel = "EMAIL" | "SMS" | "VOICE" | "VIDEO" | "SHARE_PAGE" | "COPILOT"

export type GrowthReasoningObservationCategory =
  | "verified_company"
  | "industry"
  | "persona"
  | "account"
  | "buyer_journey"
  | "engagement"
  | "memory"
  | "outcome_guidance"
  | "sequence"

export type GrowthReasoningObservation = {
  id: string
  category: GrowthReasoningObservationCategory
  statement: string
  confidence: number
  importance: number
  freshness: number
}

export type GrowthReasoningPriorityResult = {
  topInsights: GrowthReasoningObservation[]
  secondaryInsights: GrowthReasoningObservation[]
  ignoredInsights: GrowthReasoningObservation[]
}

export type GrowthMessagePlan = {
  openingStrategy: string
  credibilityStrategy: string
  valueStrategy: string
  proofStrategy: string
  ctaStrategy: string
  avoidTopics: string[]
  narrativeOrder: string[]
}

export type GrowthNarrativeBrief = {
  audience: string
  stage: string
  persona: string
  companySummary: string
  primaryProblems: string[]
  valueThemes: string[]
  proofThemes: string[]
  nextBestAction: string
  tone: string
  objective: string
}

export type GrowthReasoningDiagnostics = {
  observations: GrowthReasoningObservation[]
  topInsights: GrowthReasoningObservation[]
  secondaryInsights: GrowthReasoningObservation[]
  ignoredInsights: GrowthReasoningObservation[]
  messagePlan: GrowthMessagePlan
  narrativeBrief: GrowthNarrativeBrief
  confidence: number
  /** GS-AI-PLAYBOOK-4C — sequence progression diagnostics when available. */
  sequenceDiagnostics?: import("@/lib/growth/sequence-intelligence/growth-sequence-state-types").GrowthSequenceDiagnostics | null
}

export type GrowthReasoningContext = {
  channel: GrowthReasoningChannel
  diagnostics: GrowthReasoningDiagnostics
}

export const GROWTH_REASONING_PRIMARY_INSIGHT_LIMITS: Record<GrowthReasoningChannel, number> = {
  EMAIL: 5,
  SMS: 2,
  VOICE: 3,
  VIDEO: 5,
  SHARE_PAGE: 6,
  COPILOT: 5,
}
