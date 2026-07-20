/**
 * GE-AIOS-NEXT-3C — Enrich existing Home executive language with evidence-backed reasoning.
 * Presentation-only — no new sections, no new engines.
 */

import type { GrowthHomeAvaBusinessObjectiveLeadershipPayload } from "@/lib/growth/ava-home/recommendations/growth-home-ava-business-objective-next-1e-types"
import type { GrowthHomeAvaContinuousExecutiveBriefingPayload } from "@/lib/growth/ava-home/recommendations/growth-home-ava-executive-briefing-cursor-next-2a-types"
import type { GrowthHomeAvaRecommendationExperience } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1a-types"
import type { GrowthHomeAvaStrategicLeadershipPayload } from "@/lib/growth/ava-home/recommendations/growth-home-ava-strategic-leadership-next-1f-types"
import {
  buildExecutiveReasoningLines,
  buildGrowthHomeAvaExecutiveReasoningNext3c,
  polishExecutiveLanguage,
} from "./growth-home-ava-executive-reasoning-next-3c"
import type {
  GrowthHomeAvaExecutiveReasoningInput,
  GrowthHomeAvaExecutiveReasoningPayload,
} from "./growth-home-ava-executive-reasoning-next-3c-types"

export type GrowthHomeExecutiveLanguageEnrichmentNext3c = {
  executiveReasoning: GrowthHomeAvaExecutiveReasoningPayload
  strategicLeadership: GrowthHomeAvaStrategicLeadershipPayload | null
  continuousExecutiveBriefing: GrowthHomeAvaContinuousExecutiveBriefingPayload | null
  recommendationExperience: GrowthHomeAvaRecommendationExperience | null
  businessObjectiveLeadership: GrowthHomeAvaBusinessObjectiveLeadershipPayload | null
}

function enrichStrategicLeadership(
  leadership: GrowthHomeAvaStrategicLeadershipPayload | null,
  reasoning: GrowthHomeAvaExecutiveReasoningPayload,
): GrowthHomeAvaStrategicLeadershipPayload | null {
  if (!leadership) return null

  const primary = reasoning.primary
  let insight = leadership.insight
  let recommendation = leadership.recommendation

  if (primary && insight) {
    insight = {
      ...insight,
      observation: polishExecutiveLanguage(primary.observation),
      evidenceSources: [...new Set([...insight.evidenceSources, ...primary.evidenceSources])],
      confidence:
        primary.confidence === "high" ||
        primary.confidence === "moderate" ||
        primary.confidence === "low"
          ? primary.confidence
          : insight.confidence,
      confidenceReason: polishExecutiveLanguage(primary.confidenceReason),
    }
  }

  if (primary && recommendation) {
    recommendation = {
      ...recommendation,
      headline: polishExecutiveLanguage(recommendation.headline),
      summary: polishExecutiveLanguage(recommendation.summary),
      whatObserved: [primary.observation, ...primary.evidence.slice(0, 2)],
      supportingEvidence: [...new Set([...recommendation.supportingEvidence, ...primary.evidenceSources])],
      confidence:
        primary.confidence === "high" ||
        primary.confidence === "moderate" ||
        primary.confidence === "low"
          ? primary.confidence
          : recommendation.confidence,
      confidenceReason: polishExecutiveLanguage(primary.confidenceReason),
      expectedImpact: primary.expectedImpact ?? recommendation.expectedImpact,
      potentialRisks: [
        ...primary.alternativeExplanations.slice(0, 2),
        ...recommendation.potentialRisks,
      ].slice(0, 4),
    }
  } else if (primary && !recommendation && primary.recommendation) {
    recommendation = {
      headline: polishExecutiveLanguage("Based on available evidence, I recommend the following focus."),
      summary: polishExecutiveLanguage(primary.recommendation),
      recommendedFocusShift: primary.recommendation,
      whatObserved: [primary.observation, ...primary.evidence.slice(0, 2)],
      whyItMatters: primary.expectedImpact ?? "Improving throughput where evidence shows the strongest constraint.",
      supportingEvidence: primary.evidenceSources,
      confidence:
        primary.confidence === "high" || primary.confidence === "moderate" || primary.confidence === "low"
          ? primary.confidence
          : "low",
      confidenceReason: polishExecutiveLanguage(primary.confidenceReason),
      expectedImpact: primary.expectedImpact ?? "Improved organizational throughput.",
      potentialRisks: primary.alternativeExplanations.slice(0, 2),
      whatWouldChange: ["Executive priority for the next review cycle"],
      whatRemainsTheSame: ["Approval-gated outreach", "Business Profile authority", "Existing qualified pipeline"],
      estimatedBenefit: primary.expectedImpact,
      recommendedObjectiveLabel: null,
      objectivesReviewHref: "/growth/objectives",
    }
  }

  return {
    ...leadership,
    subtitle: primary
      ? polishExecutiveLanguage("Based on available evidence...")
      : leadership.subtitle,
    insight,
    recommendation,
    executiveReasoning: reasoning,
  }
}

function enrichBriefing(
  briefing: GrowthHomeAvaContinuousExecutiveBriefingPayload | null,
  reasoning: GrowthHomeAvaExecutiveReasoningPayload,
): GrowthHomeAvaContinuousExecutiveBriefingPayload | null {
  if (!briefing) return null
  const lines = buildExecutiveReasoningLines(reasoning)
  return {
    ...briefing,
    executiveReasoningLines: lines,
    selfEvaluationLines: [...briefing.selfEvaluationLines, ...lines.slice(0, 2)].slice(0, 4),
    planAdjustmentLine: reasoning.primary?.recommendation ?? briefing.planAdjustmentLine,
  }
}

function enrichRecommendations(
  experience: GrowthHomeAvaRecommendationExperience | null,
  reasoning: GrowthHomeAvaExecutiveReasoningPayload,
): GrowthHomeAvaRecommendationExperience | null {
  if (!experience) return null
  const line = reasoning.synthesisSummary ?? reasoning.primary?.recommendation ?? null
  if (!line) return experience

  const recommendations = experience.recommendations.map((item, index) => {
    if (index !== 0) return item
    return {
      ...item,
      headline: polishExecutiveLanguage(item.headline),
      employeeHeadline: item.employeeHeadline
        ? polishExecutiveLanguage(item.employeeHeadline)
        : polishExecutiveLanguage(item.headline),
      executiveReasoningLine: line,
      whyReasons: [...new Set([line, ...item.whyReasons])].slice(0, 4),
    }
  })

  return {
    ...experience,
    recommendationIntro: polishExecutiveLanguage(experience.recommendationIntro),
    recommendations,
    executiveReasoningLine: line,
  }
}

function enrichObjectiveLeadership(
  leadership: GrowthHomeAvaBusinessObjectiveLeadershipPayload | null,
  reasoning: GrowthHomeAvaExecutiveReasoningPayload,
): GrowthHomeAvaBusinessObjectiveLeadershipPayload | null {
  if (!leadership) return null
  const line = reasoning.primary?.observation ?? reasoning.synthesisSummary
  if (!line) return leadership
  return {
    ...leadership,
    recommendationIntro: polishExecutiveLanguage(leadership.recommendationIntro),
    executiveReasoningLine: polishExecutiveLanguage(line),
  }
}

export function enrichGrowthHomeExecutiveLanguageNext3c(input: {
  reasoningInput: GrowthHomeAvaExecutiveReasoningInput
  strategicLeadership?: GrowthHomeAvaStrategicLeadershipPayload | null
  continuousExecutiveBriefing?: GrowthHomeAvaContinuousExecutiveBriefingPayload | null
  recommendationExperience?: GrowthHomeAvaRecommendationExperience | null
  businessObjectiveLeadership?: GrowthHomeAvaBusinessObjectiveLeadershipPayload | null
}): GrowthHomeExecutiveLanguageEnrichmentNext3c {
  const executiveReasoning = buildGrowthHomeAvaExecutiveReasoningNext3c(input.reasoningInput)

  return {
    executiveReasoning,
    strategicLeadership: enrichStrategicLeadership(input.strategicLeadership ?? null, executiveReasoning),
    continuousExecutiveBriefing: enrichBriefing(
      input.continuousExecutiveBriefing ?? null,
      executiveReasoning,
    ),
    recommendationExperience: enrichRecommendations(
      input.recommendationExperience ?? null,
      executiveReasoning,
    ),
    businessObjectiveLeadership: enrichObjectiveLeadership(
      input.businessObjectiveLeadership ?? null,
      executiveReasoning,
    ),
  }
}
