/** GS-AI-PLAYBOOK-3B — Multi-pass personalization quality engine (client-safe). */

import {
  buildPersonalizationQualityDiagnostics,
  evaluatePersonalizationQualityInput,
} from "@/lib/growth/personalization/quality/growth-personalization-quality-diagnostics"
import { evaluatePersonalizationQualityDimensions } from "@/lib/growth/personalization/quality/growth-personalization-quality-evaluator"
import {
  rewriteGrowthPersonalizationContent,
  rewriteSharePageContent,
  rewriteVideoScript,
} from "@/lib/growth/personalization/quality/growth-personalization-quality-rewriter"
import {
  GROWTH_PERSONALIZATION_QUALITY_QA_MARKER,
  type GrowthPersonalizationQualityInput,
  type GrowthPersonalizationQualityResult,
  type GrowthPersonalizationSharePageQualityInput,
  type GrowthPersonalizationVideoScriptQualityInput,
} from "@/lib/growth/personalization/quality/growth-personalization-quality-types"
import type { GrowthIndustryContext } from "@/lib/growth/playbooks/growth-industry-context-types"
import type { GrowthReasoningDiagnostics } from "@/lib/growth/reasoning/growth-reasoning-types"
import type { GrowthSequenceDiagnostics } from "@/lib/growth/sequence-intelligence/growth-sequence-state-types"
import { formatGrowthReasoningOperatorPreview } from "@/lib/growth/reasoning/growth-reasoning-diagnostics"

export { GROWTH_PERSONALIZATION_QUALITY_QA_MARKER }
export type {
  GrowthPersonalizationQualityDiagnostics,
  GrowthPersonalizationQualityInput,
  GrowthPersonalizationQualityResult,
} from "@/lib/growth/personalization/quality/growth-personalization-quality-types"
export { buildPersonalizationQualityOperatorPreview } from "@/lib/growth/personalization/quality/growth-personalization-quality-diagnostics"

export function buildPersonalizationQualityContextHints(
  industryContext?: GrowthIndustryContext | null,
): {
  industryLabel?: string | null
  industryFact?: string | null
  preferredCta?: string | null
} {
  if (!industryContext) return {}
  return {
    industryLabel: industryContext.playbook?.displayName ?? null,
    industryFact: industryContext.industryFacts[0] ?? null,
    preferredCta: industryContext.personaMessagingContext?.preferredCtaBlock?.split("\n")[0] ?? null,
  }
}

export function applyGrowthPersonalizationQualityPass(
  input: GrowthPersonalizationQualityInput,
): GrowthPersonalizationQualityResult {
  const before = evaluatePersonalizationQualityDimensions(input)
  let subject = input.subject ?? null
  let body = input.body
  let rewritesApplied: string[] = []

  if (!input.skipRewrite) {
    const rewritten = rewriteGrowthPersonalizationContent({
      channel: input.channel,
      subject,
      body,
      companyName: input.companyName,
      contactName: input.contactName,
      allowedFacts: input.allowedFacts,
      industryLabel: input.industryLabel,
      industryFact: input.industryFact,
      preferredCta: input.preferredCta,
      issues: before.issuesDetected,
      maxWords: input.maxWords,
      maxChars: input.maxChars,
    })
    subject = rewritten.subject
    body = rewritten.body
    rewritesApplied = rewritten.rewritesApplied
  }

  const after = evaluatePersonalizationQualityDimensions({ ...input, subject, body })
  const diagnostics = buildPersonalizationQualityDiagnostics({
    evaluation: after,
    rewritesApplied,
  })

  return {
    subject,
    body,
    diagnostics,
    qualityApplied: rewritesApplied.length > 0,
  }
}

export function applyGrowthPersonalizationQualityPassWithIndustryContext(input: {
  channel: GrowthPersonalizationQualityInput["channel"]
  subject?: string | null
  body: string
  companyName?: string | null
  contactName?: string | null
  allowedFacts?: string[]
  industryContext?: GrowthIndustryContext | null
  reasoningDiagnostics?: GrowthReasoningDiagnostics | null
  sequenceDiagnostics?: GrowthSequenceDiagnostics | null
  maxWords?: number
  maxChars?: number
  skipRewrite?: boolean
}): GrowthPersonalizationQualityResult {
  const hints = buildPersonalizationQualityContextHints(input.industryContext)
  const result = applyGrowthPersonalizationQualityPass({
    channel: input.channel,
    subject: input.subject,
    body: input.body,
    companyName: input.companyName,
    contactName: input.contactName,
    allowedFacts: input.allowedFacts,
    industryLabel: hints.industryLabel,
    industryFact: hints.industryFact,
    preferredCta: hints.preferredCta,
    maxWords: input.maxWords,
    maxChars: input.maxChars,
    skipRewrite: input.skipRewrite,
  })
  const reasoning =
    input.reasoningDiagnostics ?? input.industryContext?.reasoningContext?.diagnostics ?? null
  const sequence =
    input.sequenceDiagnostics ??
    reasoning?.sequenceDiagnostics ??
    input.industryContext?.sequenceIntelligenceContext?.diagnostics ??
    null
  if (input.industryContext?.buyerJourneyContext?.diagnostics) {
    result.diagnostics = {
      ...result.diagnostics,
      buyerJourneyDiagnostics: input.industryContext.buyerJourneyContext.diagnostics,
      suggestions: [
        ...result.diagnostics.suggestions,
        ...input.industryContext.buyerJourneyContext.diagnostics.nextBestActions.avoidActions.map(
          (entry) => `Avoid: ${entry}`,
        ),
      ].slice(0, 6),
    }
  }
  if (reasoning) {
    const reasoningPreview = formatGrowthReasoningOperatorPreview(reasoning)
    result.diagnostics = {
      ...result.diagnostics,
      reasoningDiagnostics: reasoning,
      suggestions: [
        ...result.diagnostics.suggestions,
        ...reasoningPreview.recommendedApproach.slice(0, 2),
      ].slice(0, 6),
    }
  }
  if (sequence) {
    result.diagnostics = {
      ...result.diagnostics,
      sequenceDiagnostics: sequence,
      suggestions: [
        ...result.diagnostics.suggestions,
        ...sequence.guidance.avoidPatterns.slice(0, 2),
      ].slice(0, 6),
    }
  }
  return result
}

export function applySharePagePersonalizationQualityPass(input: GrowthPersonalizationSharePageQualityInput) {
  const combined = [input.headline, input.heroMessage, input.whyReachingOut, input.ctaLabel].join(" ")
  const before = evaluatePersonalizationQualityDimensions({
    channel: "SHARE_PAGE",
    body: combined,
    companyName: input.companyName,
    allowedFacts: input.allowedFacts,
  })
  const rewritten = rewriteSharePageContent(input)
  const after = evaluatePersonalizationQualityDimensions({
    channel: "SHARE_PAGE",
    body: [rewritten.headline, rewritten.heroMessage, rewritten.whyReachingOut, rewritten.ctaLabel].join(" "),
    companyName: input.companyName,
    allowedFacts: input.allowedFacts,
  })
  return {
    ...rewritten,
    diagnostics: buildPersonalizationQualityDiagnostics({
      evaluation: after,
      rewritesApplied: rewritten.rewritesApplied,
    }),
    qualityApplied: rewritten.rewritesApplied.length > 0,
    beforeScore: buildPersonalizationQualityDiagnostics({ evaluation: before, rewritesApplied: [] }).overallQualityScore,
  }
}

export function applyVideoPersonalizationQualityPass(input: GrowthPersonalizationVideoScriptQualityInput) {
  const before = evaluatePersonalizationQualityDimensions({
    channel: "VIDEO",
    body: input.script,
    companyName: input.companyName,
    allowedFacts: input.allowedFacts,
    maxWords: 180,
  })
  const rewritten = rewriteVideoScript(input)
  const after = evaluatePersonalizationQualityDimensions({
    channel: "VIDEO",
    body: rewritten.script,
    companyName: input.companyName,
    allowedFacts: input.allowedFacts,
    maxWords: 180,
  })
  return {
    script: rewritten.script,
    diagnostics: buildPersonalizationQualityDiagnostics({
      evaluation: after,
      rewritesApplied: rewritten.rewritesApplied,
    }),
    qualityApplied: rewritten.rewritesApplied.length > 0,
    beforeScore: buildPersonalizationQualityDiagnostics({ evaluation: before, rewritesApplied: [] }).overallQualityScore,
  }
}

export { evaluatePersonalizationQualityInput }
