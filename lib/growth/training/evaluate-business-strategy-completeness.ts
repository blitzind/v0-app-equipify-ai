/** GE-AIOS-19C-2E — Evaluate Business Strategy completeness (client-safe). */

import {
  resolveBusinessStrategyContent,
  type BusinessStrategyContent,
} from "@/lib/growth/training/growth-business-strategy-types"
import {
  GROWTH_BUSINESS_STRATEGY_TRAINABLE_SECTIONS,
  type GrowthBusinessStrategyTrainableSectionKey,
} from "@/lib/growth/training/growth-business-strategy-trainable-sections"

export type BusinessStrategyCompleteness = {
  hasContent: boolean
  filledSectionCount: number
  totalSectionCount: number
  missingAreas: string[]
  wellUnderstoodAreas: string[]
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim())
}

function hasList(values: string[] | null | undefined): boolean {
  return Boolean(values?.some((entry) => entry.trim()))
}

function evaluateTrainableSectionFilled(
  content: BusinessStrategyContent,
): Record<GrowthBusinessStrategyTrainableSectionKey, boolean> {
  return {
    company_principles:
      hasText(content.companyWide.mission) || hasList(content.companyWide.coreValues),
    messaging:
      hasText(content.messaging.elevatorPitch) || hasText(content.messaging.tone),
    positioning:
      hasList(content.positioning.competitiveAdvantages) ||
      hasText(content.positioning.pricingPhilosophy),
    objections: content.objections.items.some(
      (item) => hasText(item.objection) || hasText(item.preferredResponse),
    ),
    sales_philosophy:
      hasList(content.salesPhilosophy.qualificationStandards) ||
      hasList(content.salesPhilosophy.discoveryQuestions),
    sales_and_relationships:
      hasList(content.salesAndRelationships.principles) ||
      hasText(content.salesAndRelationships.notes),
  }
}

export function evaluateBusinessStrategyCompleteness(
  strategy: BusinessStrategyContent | null | undefined,
): BusinessStrategyCompleteness {
  const content = resolveBusinessStrategyContent(strategy)
  const sections = evaluateTrainableSectionFilled(content)
  const filled = GROWTH_BUSINESS_STRATEGY_TRAINABLE_SECTIONS.filter(
    (section) => sections[section.key],
  )
  const missing = GROWTH_BUSINESS_STRATEGY_TRAINABLE_SECTIONS.filter(
    (section) => !sections[section.key],
  ).map((section) => section.label)

  return {
    hasContent: filled.length > 0,
    filledSectionCount: filled.length,
    totalSectionCount: GROWTH_BUSINESS_STRATEGY_TRAINABLE_SECTIONS.length,
    missingAreas: missing,
    wellUnderstoodAreas: filled.map((section) => section.label),
  }
}
