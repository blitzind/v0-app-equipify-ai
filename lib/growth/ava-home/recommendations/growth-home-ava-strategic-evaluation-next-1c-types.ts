/** GE-AIOS-NEXT-1C — Strategic advisor evaluation types (client-safe). */

import type { GrowthHomeAvaMissionIntentInterpretation } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1b-types"

export const GROWTH_AIOS_NEXT_1C_STRATEGIC_ADVISOR_QA_MARKER =
  "ge-aios-next-1c-ava-strategic-advisor-v1" as const

export type GrowthHomeAvaStrategicAlignment = "strong_fit" | "partial_fit" | "poor_fit" | "not_applicable"

export type GrowthHomeAvaStrategicAlternative = {
  label: string
  rationale: string
}

export type GrowthHomeAvaStrategicEvaluation = {
  qaMarker: typeof GROWTH_AIOS_NEXT_1C_STRATEGIC_ADVISOR_QA_MARKER
  alignment: GrowthHomeAvaStrategicAlignment
  openingLine: string
  perspectiveLine: string
  supportiveReasons: string[]
  concernReasons: string[]
  recommendedAlternative: GrowthHomeAvaStrategicAlternative | null
  alternativeOptions: GrowthHomeAvaStrategicAlternative[]
  confidenceLabel: string | null
  evidenceSources: string[]
  proceedRecommendation: "support" | "refine" | "challenge"
  allowsOverride: true
  overrideAcknowledgment: string | null
  interpretedIntent: GrowthHomeAvaMissionIntentInterpretation
}

export type GrowthHomeAvaStrategicIntentEvaluation = {
  interpretation: GrowthHomeAvaMissionIntentInterpretation
  evaluation: GrowthHomeAvaStrategicEvaluation | null
}
