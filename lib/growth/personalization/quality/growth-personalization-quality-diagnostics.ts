/** GS-AI-PLAYBOOK-3B — Quality diagnostics & operator preview (client-safe). */

import {
  computeOverallQualityScore,
  evaluatePersonalizationQualityDimensions,
} from "@/lib/growth/personalization/quality/growth-personalization-quality-evaluator"
import type {
  GrowthPersonalizationQualityDiagnostics,
  GrowthPersonalizationQualityDimension,
  GrowthPersonalizationQualityDimensionScores,
  GrowthPersonalizationQualityInput,
  GrowthPersonalizationQualityIssueType,
} from "@/lib/growth/personalization/quality/growth-personalization-quality-types"

const DIMENSION_LABELS: Record<GrowthPersonalizationQualityDimension, string> = {
  specificity: "Specificity",
  consultativeTone: "Consultative tone",
  credibility: "Credibility",
  personalization: "Personalization",
  clarity: "Clarity",
  conciseness: "Conciseness",
  flow: "Flow",
  ctaQuality: "CTA quality",
  humanTone: "Human tone",
  evidenceUsage: "Evidence usage",
}

const ISSUE_SUGGESTIONS: Record<GrowthPersonalizationQualityIssueType, string> = {
  generic_opening: "Opening could be more personalized",
  generic_pain: "Replace generic pain framing with verified company context",
  too_salesy: "Soften promotional language",
  feature_dump: "Lead with industry relevance before product capabilities",
  weak_cta: "CTA too generic — use a consultative discovery question",
  repetitive_language: "Reduce repeated phrasing",
  ai_sounding_phrases: "Remove AI-sounding filler phrases",
  unsupported_claim: "Remove claims not supported by verified facts",
  paragraph_length: "Shorten long paragraphs for readability",
  poor_sequence: "Reorder copy: opener → industry relevance → proof → CTA",
}

export function buildPersonalizationQualityStrengths(
  scores: GrowthPersonalizationQualityDimensionScores,
): string[] {
  const strengths: string[] = []
  for (const [key, label] of Object.entries(DIMENSION_LABELS) as Array<[GrowthPersonalizationQualityDimension, string]>) {
    if (scores[key] >= 80) {
      strengths.push(`Strong ${label.toLowerCase()}`)
    }
  }
  if (strengths.length === 0 && scores.credibility >= 70) {
    strengths.push("Credible evidence usage")
  }
  return strengths.slice(0, 4)
}

export function buildPersonalizationQualitySuggestions(input: {
  scores: GrowthPersonalizationQualityDimensionScores
  issuesDetected: GrowthPersonalizationQualityIssueType[]
}): string[] {
  const suggestions = input.issuesDetected.map((issue) => ISSUE_SUGGESTIONS[issue])
  if (input.scores.specificity < 70 && !input.issuesDetected.includes("generic_opening")) {
    suggestions.push("Add a verified company observation in the opening")
  }
  if (input.scores.ctaQuality < 70 && !input.issuesDetected.includes("weak_cta")) {
    suggestions.push("CTA could be more consultative")
  }
  if (input.scores.evidenceUsage < 65) {
    suggestions.push("Reference verified research or company facts more directly")
  }
  return [...new Set(suggestions)].slice(0, 5)
}

export function buildPersonalizationQualityDiagnostics(input: {
  evaluation: ReturnType<typeof evaluatePersonalizationQualityDimensions>
  rewritesApplied: string[]
  buyerJourneyDiagnostics?: GrowthPersonalizationQualityDiagnostics["buyerJourneyDiagnostics"]
}): GrowthPersonalizationQualityDiagnostics {
  const overallQualityScore = computeOverallQualityScore(input.evaluation.dimensionScores)
  const suggestions = buildPersonalizationQualitySuggestions({
    scores: input.evaluation.dimensionScores,
    issuesDetected: input.evaluation.issuesDetected,
  })
  if (input.buyerJourneyDiagnostics?.nextBestActions.avoidActions.length) {
    suggestions.push(
      ...input.buyerJourneyDiagnostics.nextBestActions.avoidActions.map((entry) => `Avoid: ${entry}`),
    )
  }
  return {
    overallQualityScore,
    dimensionScores: input.evaluation.dimensionScores,
    issuesDetected: input.evaluation.issuesDetected,
    rewritesApplied: input.rewritesApplied,
    strengths: buildPersonalizationQualityStrengths(input.evaluation.dimensionScores),
    suggestions: [...new Set(suggestions)].slice(0, 6),
    buyerJourneyDiagnostics: input.buyerJourneyDiagnostics ?? null,
  }
}

export function buildPersonalizationQualityOperatorPreview(
  diagnostics: GrowthPersonalizationQualityDiagnostics,
): {
  qualityScore: number
  strengths: string[]
  suggestions: string[]
} {
  return {
    qualityScore: diagnostics.overallQualityScore,
    strengths: diagnostics.strengths,
    suggestions: diagnostics.suggestions,
  }
}

export function evaluatePersonalizationQualityInput(
  input: GrowthPersonalizationQualityInput,
): GrowthPersonalizationQualityDiagnostics {
  const evaluation = evaluatePersonalizationQualityDimensions(input)
  return buildPersonalizationQualityDiagnostics({ evaluation, rewritesApplied: [] })
}
