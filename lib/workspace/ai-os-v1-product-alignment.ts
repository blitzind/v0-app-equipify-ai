/**
 * GE-AI-ARCH-2C — AI OS v1 product alignment (presentation-only).
 * AI OS v1 helps Equipify sell Equipify. Service Operator surfaces are future vision.
 */

import type { AiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"

export const GE_AI_ARCH_2C_QA_MARKER = "ge-ai-arch-2c-ai-os-v1-product-alignment-v1" as const

/** v1 default: Service Operator Home sections are future vision — synthesizers may still run. */
export const GROWTH_HOME_SERVICE_OPERATOR_VISIBLE = false as const

export function aiOsV1ProductStory(teammate: AiTeammatePresentation): string {
  return `${teammate.name} is Equipify's autonomous AI Growth Operator. ${teammate.subjectPronoun} researches prospects, prepares campaigns, books meetings, learns from results, and helps us sell Equipify.`
}

export function isGrowthHomeServiceOperatorVisible(): boolean {
  return GROWTH_HOME_SERVICE_OPERATOR_VISIBLE
}
