/**
 * GE-AIOS-NEXT-3E — Feed topic credibility into NEXT-3C executive reasoning (presentation-only).
 */

import { polishExecutiveLanguage } from "@/lib/growth/ava-home/recommendations/growth-home-ava-executive-reasoning-next-3c"
import type { GrowthHomeAvaExecutiveReasoningPayload } from "@/lib/growth/ava-home/recommendations/growth-home-ava-executive-reasoning-next-3c-types"
import type { GrowthOrganizationalLearningCertificationSnapshot } from "@/lib/growth/organizational-effectiveness/growth-organizational-learning-certification-next-3e-types"

export function enrichExecutiveReasoningWithLearningCertificationNext3e(input: {
  reasoning: GrowthHomeAvaExecutiveReasoningPayload | null
  certification: GrowthOrganizationalLearningCertificationSnapshot | null
}): GrowthHomeAvaExecutiveReasoningPayload | null {
  if (!input.reasoning) return null
  if (!input.certification?.primaryTopicCredibility) return input.reasoning

  const credibility = input.certification.primaryTopicCredibility
  const primary = input.reasoning.primary
  if (!primary) return input.reasoning

  const learningLines = input.certification.executiveReasoningLines.filter(Boolean)
  const enrichedPrimary = {
    ...primary,
    confidenceReason: polishExecutiveLanguage(
      [primary.confidenceReason, credibility.learningStatement, credibility.uncertaintyStatement]
        .filter(Boolean)
        .join(" "),
    ),
    alternativeExplanations: [
      ...new Set([
        ...primary.alternativeExplanations,
        ...credibility.latestComparison?.competingExplanations.slice(0, 2) ?? [],
        credibility.confidenceEvolution === "stable" &&
        credibility.positiveWindows > 0 &&
        credibility.negativeWindows > 0
          ? "Mixed mature windows suggest competing explanations remain plausible."
          : null,
      ]),
    ]
      .filter((line): line is string => Boolean(line))
      .slice(0, 4),
  }

  return {
    ...input.reasoning,
    primary: enrichedPrimary,
    synthesisSummary: polishExecutiveLanguage(
      learningLines[0] ?? input.reasoning.synthesisSummary ?? enrichedPrimary.observation,
    ),
  }
}
