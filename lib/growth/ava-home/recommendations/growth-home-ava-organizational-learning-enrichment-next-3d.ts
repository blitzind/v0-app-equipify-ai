/**
 * GE-AIOS-NEXT-3D — Enrich existing Home executive language with organizational learning.
 * Presentation-only — no new sections, no new engines.
 */

import type { GrowthHomeAvaBusinessObjectiveLeadershipPayload } from "@/lib/growth/ava-home/recommendations/growth-home-ava-business-objective-next-1e-types"
import type { GrowthHomeAvaContinuousExecutiveBriefingPayload } from "@/lib/growth/ava-home/recommendations/growth-home-ava-executive-briefing-cursor-next-2a-types"
import type { GrowthHomeAvaRecommendationExperience } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1a-types"
import type { GrowthHomeAvaStrategicLeadershipPayload } from "@/lib/growth/ava-home/recommendations/growth-home-ava-strategic-leadership-next-1f-types"
import { polishExecutiveLanguage } from "./growth-home-ava-executive-reasoning-next-3c"
import type { GrowthHomeExecutiveLanguageEnrichmentNext3c } from "./growth-home-ava-executive-language-enrichment-next-3c"
import type { GrowthHomeAvaRecommendationAccountabilitySnapshot } from "./growth-home-ava-recommendation-accountability-next-3d-types"

export type GrowthHomeExecutiveLanguageEnrichmentNext3d = GrowthHomeExecutiveLanguageEnrichmentNext3c & {
  recommendationAccountability: GrowthHomeAvaRecommendationAccountabilitySnapshot | null
}

function enrichStrategicLeadership(
  leadership: GrowthHomeAvaStrategicLeadershipPayload | null,
  learningLine: string | null,
): GrowthHomeAvaStrategicLeadershipPayload | null {
  if (!leadership || !learningLine) return leadership
  const recommendation = leadership.recommendation
    ? {
        ...leadership.recommendation,
        summary: polishExecutiveLanguage(
          `${leadership.recommendation.summary} ${learningLine}`.trim(),
        ),
      }
    : null
  return {
    ...leadership,
    recommendation,
    insight: leadership.insight
      ? {
          ...leadership.insight,
          strategicMemoryLine: learningLine,
        }
      : leadership.insight,
  }
}

function enrichBriefing(
  briefing: GrowthHomeAvaContinuousExecutiveBriefingPayload | null,
  learningLine: string | null,
): GrowthHomeAvaContinuousExecutiveBriefingPayload | null {
  if (!briefing || !learningLine) return briefing
  return {
    ...briefing,
    organizationalLearningLines: [polishExecutiveLanguage(learningLine)],
    selfEvaluationLines: [...briefing.selfEvaluationLines, polishExecutiveLanguage(learningLine)].slice(0, 5),
  }
}

function enrichRecommendations(
  experience: GrowthHomeAvaRecommendationExperience | null,
  learningLine: string | null,
  recommendationTopic: string | null,
): GrowthHomeAvaRecommendationExperience | null {
  if (!experience) return null
  if (!learningLine && !recommendationTopic) return experience
  const polished = learningLine ? polishExecutiveLanguage(learningLine) : null
  return {
    ...experience,
    organizationalLearningLine: polished,
    recommendationTopic: recommendationTopic ?? experience.recommendationTopic ?? null,
    recommendations: experience.recommendations.map((item, index) =>
      index === 0
        ? {
            ...item,
            organizationalLearningLine: polished,
            supportingLine: item.supportingLine ?? polished,
          }
        : item,
    ),
  }
}

function enrichObjectiveLeadership(
  leadership: GrowthHomeAvaBusinessObjectiveLeadershipPayload | null,
  learningLine: string | null,
): GrowthHomeAvaBusinessObjectiveLeadershipPayload | null {
  if (!leadership || !learningLine) return leadership
  return {
    ...leadership,
    organizationalLearningLine: polishExecutiveLanguage(learningLine),
  }
}

export function enrichGrowthHomeOrganizationalLearningNext3d(input: {
  executiveLanguage: GrowthHomeExecutiveLanguageEnrichmentNext3c
  accountability?: GrowthHomeAvaRecommendationAccountabilitySnapshot | null
}): GrowthHomeExecutiveLanguageEnrichmentNext3d {
  const learningLine = input.accountability?.organizationalLearningLine ?? null

  return {
    ...input.executiveLanguage,
    recommendationAccountability: input.accountability ?? null,
    strategicLeadership: enrichStrategicLeadership(input.executiveLanguage.strategicLeadership, learningLine),
    continuousExecutiveBriefing: enrichBriefing(
      input.executiveLanguage.continuousExecutiveBriefing,
      learningLine,
    ),
    recommendationExperience: enrichRecommendations(
      input.executiveLanguage.recommendationExperience,
      learningLine,
      input.accountability?.primaryTopic ?? null,
    ),
    businessObjectiveLeadership: enrichObjectiveLeadership(
      input.executiveLanguage.businessObjectiveLeadership,
      learningLine,
    ),
  }
}
