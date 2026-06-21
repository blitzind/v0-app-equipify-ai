/** GS-AI-PLAYBOOK-4D.1 — Stack B audit metadata for personalization dashboard (client-safe). */

import type { OutreachPersonalizationAudit } from "@/lib/growth/outreach/personalization/personalization-types"

export const GROWTH_PERSONALIZATION_STACK_B_UNIFICATION_QA_MARKER =
  "growth-personalization-stack-b-unification-gs-ai-playbook-4d1-v1" as const

export type GrowthPersonalizationStackBGenerationMetadata = {
  qaMarker: typeof GROWTH_PERSONALIZATION_STACK_B_UNIFICATION_QA_MARKER
  generationType: string
  strategyVersion: string
  variationKey: string
  confidenceScore: number
  refinedByAi: boolean
  industryPlaybookApplied: boolean
  reasoningApplied: boolean
  sequenceGuidanceApplied: boolean
  buyerJourneyApplied: boolean
  qualityApplied: boolean
  legacyFallback: boolean
}

export type GrowthPersonalizationStackBDiagnosticsMetadata = {
  industryDiagnostics?: {
    industryId: string | null
    displayName: string | null
    confidence: number
    playbookApplied: boolean
  } | null
  personaDiagnostics?: import("@/lib/growth/playbooks/personas/growth-playbook-persona-types").GrowthPersonaMessagingDiagnostics | null
  accountDiagnostics?: import("@/lib/growth/account-intelligence/growth-account-intelligence-types").GrowthAccountIntelligenceDiagnostics | null
  buyerJourneyDiagnostics?: import("@/lib/growth/buyer-journey/growth-buying-stage-types").GrowthBuyingStageDiagnostics | null
  reasoningDiagnostics?: import("@/lib/growth/reasoning/growth-reasoning-types").GrowthReasoningDiagnostics | null
  sequenceDiagnostics?: import("@/lib/growth/sequence-intelligence/growth-sequence-state-types").GrowthSequenceDiagnostics | null
  qualityDiagnostics?: import("@/lib/growth/personalization/quality/growth-personalization-quality-types").GrowthPersonalizationQualityDiagnostics | null
  outcomeGuidanceDiagnostics?: import("@/lib/growth/playbooks/outcomes/growth-playbook-outcome-types").GrowthPlaybookOutcomeGuidanceDiagnostics | null
  stackBGeneration?: GrowthPersonalizationStackBGenerationMetadata | null
}

export function buildPersonalizationStackBMetadataFromAudit(
  audit: OutreachPersonalizationAudit,
  input?: { legacyFallback?: boolean },
): GrowthPersonalizationStackBDiagnosticsMetadata {
  const industry = audit.contextPacket.industryContext
  return {
    industryDiagnostics: industry
      ? {
          industryId: industry.industryId,
          displayName: industry.playbook?.displayName ?? null,
          confidence: industry.confidence,
          playbookApplied: industry.playbookApplied,
        }
      : null,
    personaDiagnostics: industry?.personaMessagingContext?.diagnostics ?? null,
    accountDiagnostics: industry?.accountIntelligenceContext?.diagnostics ?? null,
    buyerJourneyDiagnostics: audit.buyerJourneyDiagnostics ?? industry?.buyerJourneyContext?.diagnostics ?? null,
    reasoningDiagnostics: audit.reasoningDiagnostics ?? null,
    sequenceDiagnostics: audit.sequenceDiagnostics ?? null,
    qualityDiagnostics: audit.qualityDiagnostics ?? null,
    outcomeGuidanceDiagnostics: audit.outcomeGuidanceDiagnostics ?? industry?.outcomeGuidanceContext?.diagnostics ?? null,
    stackBGeneration: {
      qaMarker: GROWTH_PERSONALIZATION_STACK_B_UNIFICATION_QA_MARKER,
      generationType: audit.generationType,
      strategyVersion: audit.strategyVersion,
      variationKey: audit.variationKey,
      confidenceScore: audit.confidenceScore,
      refinedByAi: audit.refinedByAi,
      industryPlaybookApplied: audit.industryPlaybookApplied ?? false,
      reasoningApplied: audit.reasoningApplied ?? false,
      sequenceGuidanceApplied: audit.sequenceGuidanceApplied ?? false,
      buyerJourneyApplied: audit.buyerJourneyApplied ?? false,
      qualityApplied: audit.qualityApplied ?? false,
      legacyFallback: input?.legacyFallback ?? false,
    },
  }
}

export function parsePersonalizationStackBDiagnostics(
  metadata: unknown,
): GrowthPersonalizationStackBDiagnosticsMetadata | null {
  if (!metadata || typeof metadata !== "object") return null
  const raw = metadata as Record<string, unknown>
  const hasStack =
    raw.stackBGeneration ||
    raw.reasoningDiagnostics ||
    raw.sequenceDiagnostics ||
    raw.buyerJourneyDiagnostics
  if (!hasStack) return null

  return {
    industryDiagnostics: (raw.industryDiagnostics as GrowthPersonalizationStackBDiagnosticsMetadata["industryDiagnostics"]) ?? null,
    personaDiagnostics: (raw.personaDiagnostics as GrowthPersonalizationStackBDiagnosticsMetadata["personaDiagnostics"]) ?? null,
    accountDiagnostics: (raw.accountDiagnostics as GrowthPersonalizationStackBDiagnosticsMetadata["accountDiagnostics"]) ?? null,
    buyerJourneyDiagnostics: (raw.buyerJourneyDiagnostics as GrowthPersonalizationStackBDiagnosticsMetadata["buyerJourneyDiagnostics"]) ?? null,
    reasoningDiagnostics: (raw.reasoningDiagnostics as GrowthPersonalizationStackBDiagnosticsMetadata["reasoningDiagnostics"]) ?? null,
    sequenceDiagnostics: (raw.sequenceDiagnostics as GrowthPersonalizationStackBDiagnosticsMetadata["sequenceDiagnostics"]) ?? null,
    qualityDiagnostics: (raw.qualityDiagnostics as GrowthPersonalizationStackBDiagnosticsMetadata["qualityDiagnostics"]) ?? null,
    outcomeGuidanceDiagnostics: (raw.outcomeGuidanceDiagnostics as GrowthPersonalizationStackBDiagnosticsMetadata["outcomeGuidanceDiagnostics"]) ?? null,
    stackBGeneration: (raw.stackBGeneration as GrowthPersonalizationStackBGenerationMetadata) ?? null,
  }
}

export type GrowthPersonalizationOriginalAiDraftSnapshot = {
  subject: string
  body: string
  capturedAt: string
}

export function buildOriginalAiDraftSnapshot(input: {
  subject: string
  body: string
  capturedAt?: string
}): GrowthPersonalizationOriginalAiDraftSnapshot {
  return {
    subject: input.subject.trim(),
    body: input.body.trim(),
    capturedAt: input.capturedAt ?? new Date().toISOString(),
  }
}

export function parseOriginalAiDraftSnapshot(
  metadata: unknown,
): GrowthPersonalizationOriginalAiDraftSnapshot | null {
  if (!metadata || typeof metadata !== "object") return null
  const raw = (metadata as Record<string, unknown>).original_ai_draft
  if (!raw || typeof raw !== "object") return null
  const entry = raw as Record<string, unknown>
  const subject = typeof entry.subject === "string" ? entry.subject.trim() : ""
  const body = typeof entry.body === "string" ? entry.body.trim() : ""
  if (!subject && !body) return null
  return {
    subject,
    body,
    capturedAt: typeof entry.capturedAt === "string" ? entry.capturedAt : new Date(0).toISOString(),
  }
}

export function resolvePersonalizationOriginalAiDraft(input: {
  metadata: unknown
  subject: string
  body: string
}): GrowthPersonalizationOriginalAiDraftSnapshot {
  const parsed = parseOriginalAiDraftSnapshot(input.metadata)
  if (parsed) return parsed
  return buildOriginalAiDraftSnapshot({ subject: input.subject, body: input.body })
}
