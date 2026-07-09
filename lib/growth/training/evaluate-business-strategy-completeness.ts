/** GE-AIOS-19C-2E — Evaluate Business Strategy completeness (client-safe). */

import {
  resolveBusinessStrategyContent,
  type BusinessStrategyContent,
} from "@/lib/growth/training/growth-business-strategy-types"

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

function evaluateSectionFilled(content: BusinessStrategyContent): Record<string, boolean> {
  return {
    "company principles": hasText(content.companyWide.mission) || hasList(content.companyWide.coreValues),
    positioning: hasList(content.positioning.competitiveAdvantages) || hasText(content.positioning.pricingPhilosophy),
    messaging: hasText(content.messaging.elevatorPitch) || hasText(content.messaging.tone),
    objections: content.objections.items.some(
      (item) => hasText(item.objection) || hasText(item.preferredResponse),
    ),
    "sales philosophy":
      hasList(content.salesPhilosophy.qualificationStandards) ||
      hasList(content.salesPhilosophy.discoveryQuestions),
    "sales & relationships":
      hasList(content.salesAndRelationships.principles) || hasText(content.salesAndRelationships.notes),
    "marketing & brand":
      hasList(content.marketingAndBrand.principles) || hasText(content.marketingAndBrand.notes),
    "customer experience":
      hasList(content.customerExperience.principles) || hasText(content.customerExperience.notes),
    "service standards":
      hasList(content.serviceStandards.principles) || hasText(content.serviceStandards.notes),
    "financial guidelines":
      hasList(content.financialGuidelines.principles) || hasText(content.financialGuidelines.notes),
  }
}

export function evaluateBusinessStrategyCompleteness(
  strategy: BusinessStrategyContent | null | undefined,
): BusinessStrategyCompleteness {
  const content = resolveBusinessStrategyContent(strategy)
  const sections = evaluateSectionFilled(content)
  const entries = Object.entries(sections)
  const filled = entries.filter(([, value]) => value)
  const missing = entries.filter(([, value]) => !value).map(([label]) => label)

  const missingFromConfidence = content.confidence.missingInformation
    .map((entry) => entry.trim())
    .filter(Boolean)

  return {
    hasContent: filled.length > 0,
    filledSectionCount: filled.length,
    totalSectionCount: entries.length,
    missingAreas: [...new Set([...missing, ...missingFromConfidence])],
    wellUnderstoodAreas: filled.map(([label]) => label),
  }
}
