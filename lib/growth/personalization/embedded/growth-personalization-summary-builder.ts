/** GS-AI-PLAYBOOK-5A — Build compact lead summary from generation view (client-safe). */

import { buildPersonalizationQualityOperatorPreview } from "@/lib/growth/personalization/quality/growth-personalization-quality-engine"
import type { GrowthPersonalizationGenerationView } from "@/lib/growth/personalization/personalization-types"
import {
  GROWTH_PERSONALIZATION_EMBEDDED_QA_MARKER,
  type GrowthPersonalizationLeadSummary,
} from "@/lib/growth/personalization/embedded/growth-personalization-embedded-types"
import { formatGrowthReasoningOperatorPreview } from "@/lib/growth/reasoning/growth-reasoning-diagnostics"
import { formatGrowthSequenceOperatorPreview } from "@/lib/growth/sequence-intelligence/growth-sequence-diagnostics"
import { narrativeThemeLabel } from "@/lib/growth/sequence-intelligence/growth-narrative-progression"
import { proofStageLabel } from "@/lib/growth/sequence-intelligence/growth-proof-progression"
import { ctaStageLabel } from "@/lib/growth/sequence-intelligence/growth-cta-progression"
import { buyingStageLabel } from "@/lib/growth/buyer-journey/growth-buying-stage-guidance"
import { nextBestActionOperatorLabels } from "@/lib/growth/buyer-journey/growth-next-best-action"

function bodyPreview(body: string | null | undefined, maxLength = 180): string | null {
  if (!body?.trim()) return null
  const cleaned = body.replace(/\s+/g, " ").trim()
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1)}…` : cleaned
}

export function buildPersonalizationLeadSummary(input: {
  leadId: string
  generation: GrowthPersonalizationGenerationView | null
}): GrowthPersonalizationLeadSummary {
  const generation = input.generation
  if (!generation) {
    return {
      qaMarker: GROWTH_PERSONALIZATION_EMBEDDED_QA_MARKER,
      leadId: input.leadId,
      generationId: null,
      status: null,
      subject: null,
      bodyPreview: null,
      personalizationScore: null,
      qualityScore: null,
      industryLabel: null,
      buyingStageLabel: null,
      recommendedCta: null,
      nextNarrativeLabel: null,
      recommendedProofLabel: null,
      sequenceLabel: null,
      reasoningObjective: null,
      nextBestAction: null,
      topInsight: null,
      createdAt: null,
      hasDraft: false,
      hasStackBDiagnostics: false,
      legacyFallback: false,
    }
  }

  const stack = generation.stackBDiagnostics
  const qualityPreview = stack?.qualityDiagnostics
    ? buildPersonalizationQualityOperatorPreview(stack.qualityDiagnostics)
    : null
  const reasoningPreview = stack?.reasoningDiagnostics
    ? formatGrowthReasoningOperatorPreview(stack.reasoningDiagnostics)
    : null
  const sequencePreview = stack?.sequenceDiagnostics
    ? formatGrowthSequenceOperatorPreview(stack.sequenceDiagnostics)
    : null
  const buyerJourney = stack?.buyerJourneyDiagnostics
  const nextBestActionPlan = buyerJourney?.nextBestActions
  const nextBestAction = nextBestActionPlan
    ? nextBestActionOperatorLabels(nextBestActionPlan).primary
    : null

  return {
    qaMarker: GROWTH_PERSONALIZATION_EMBEDDED_QA_MARKER,
    leadId: input.leadId,
    generationId: generation.id,
    status: generation.status,
    subject: generation.subject || null,
    bodyPreview: bodyPreview(generation.body),
    personalizationScore: generation.personalizationScore,
    qualityScore: qualityPreview?.qualityScore ?? null,
    industryLabel:
      stack?.industryDiagnostics?.displayName ??
      generation.industryPlaybookDiagnostics?.playbookDisplayName ??
      generation.industryPlaybookDiagnostics?.resolvedIndustryLabel ??
      null,
    buyingStageLabel: buyerJourney ? buyingStageLabel(buyerJourney.buyingStage) : null,
    recommendedCta: stack?.sequenceDiagnostics?.guidance
      ? ctaStageLabel(stack.sequenceDiagnostics.guidance.nextCta)
      : null,
    nextNarrativeLabel: stack?.sequenceDiagnostics?.guidance
      ? narrativeThemeLabel(stack.sequenceDiagnostics.guidance.nextNarrative)
      : null,
    recommendedProofLabel: stack?.sequenceDiagnostics?.guidance
      ? proofStageLabel(stack.sequenceDiagnostics.guidance.nextProof)
      : null,
    sequenceLabel: sequencePreview?.sequenceLabel ?? null,
    reasoningObjective: reasoningPreview?.objective ?? null,
    nextBestAction,
    topInsight: reasoningPreview?.topInsights[0] ?? null,
    createdAt: generation.createdAt,
    hasDraft: Boolean(generation.subject?.trim() || generation.body?.trim()),
    hasStackBDiagnostics: Boolean(stack),
    legacyFallback: stack?.stackBGeneration?.legacyFallback ?? false,
  }
}
