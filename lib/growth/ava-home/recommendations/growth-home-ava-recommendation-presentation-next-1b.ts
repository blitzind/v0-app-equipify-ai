/**
 * GE-AIOS-NEXT-1B — Employee-style recommendation presentation (presentation-only).
 */

import type { GrowthCanonicalDecisionResolution } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import { projectGrowthCanonicalOperatorDecision } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-operator-projection"
import { resolveMissionPhaseFromPrimaryAction } from "@/lib/growth/aios/missions/growth-canonical-mission-1a-phases"
import {
  GROWTH_AIOS_NEXT_1B_AVA_INTENT_RECOMMENDATION_QA_MARKER,
  type GrowthHomeAvaRecommendationExplanation,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1b-types"
import type {
  GrowthHomeAvaRecommendationExperience,
  GrowthHomeAvaRecommendationItem,
  GrowthHomeAvaRecommendationKind,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1a-types"

export const GROWTH_AIOS_NEXT_1B_RECOMMENDATION_PRESENTATION_QA_MARKER =
  "ge-aios-next-1b-ava-recommendation-presentation-v1" as const

const DEFAULT_RESEARCH_EXECUTION_PATH = [
  "Finish research",
  "Prepare outreach package",
  "Wait for approval",
  "Begin outreach",
] as const

const DEFAULT_APPROVAL_EXECUTION_PATH = [
  "Review package",
  "Authorize outreach",
  "Begin outreach",
  "Schedule follow-up",
] as const

const DEFAULT_DISCOVERY_EXECUTION_PATH = [
  "Verify ICP fit",
  "Identify buyer personas",
  "Build discovery audience",
  "Begin company research",
] as const

function executionPathForKind(
  kind: GrowthHomeAvaRecommendationKind,
  thenActions: string[],
): string[] {
  if (thenActions.length >= 2) return thenActions.slice(0, 4)
  if (kind === "approval_package" || kind === "waiting_on_you") return [...DEFAULT_APPROVAL_EXECUTION_PATH]
  if (kind === "mission_discovery" || kind === "work_manager") return [...DEFAULT_DISCOVERY_EXECUTION_PATH]
  return [...DEFAULT_RESEARCH_EXECUTION_PATH]
}

function expectedOutcomeForItem(item: GrowthHomeAvaRecommendationItem): string | null {
  if (item.kind === "approval_package") {
    return item.companyName
      ? `1 review-ready opportunity package for ${item.companyName}.`
      : "1 review-ready opportunity package."
  }
  if (item.kind === "lead_decision" || item.kind === "operator_focus") {
    return item.companyName
      ? `A review-ready outreach package for ${item.companyName}.`
      : "A review-ready outreach package."
  }
  if (item.kind === "mission_discovery") {
    return "A qualified discovery audience ready for research."
  }
  if (item.kind === "work_manager" && /find|discover|hvac|companies/i.test(item.headline)) {
    return "Fresh qualified companies added to your pipeline."
  }
  return item.outcomeLine
}

function postponementRiskForKind(kind: GrowthHomeAvaRecommendationKind): string | null {
  if (kind === "approval_package" || kind === "waiting_on_you") {
    return "Outreach stays paused until you review the package."
  }
  if (kind === "lead_decision" || kind === "operator_focus") {
    return "The account may cool off while research stays incomplete."
  }
  if (kind === "mission_discovery") {
    return "Pipeline coverage can drop if discovery waits too long."
  }
  return null
}

function buildEmployeeCopy(item: GrowthHomeAvaRecommendationItem): {
  employeeHeadline: string
  employeeLeadParagraph: string
  employeeSupportingParagraph: string | null
} {
  const company = item.companyName?.trim()

  if (item.kind === "approval_package") {
    return {
      employeeHeadline: company
        ? `I recommend reviewing the opportunity package for ${company}.`
        : "I recommend reviewing the next opportunity package.",
      employeeLeadParagraph:
        item.supportingLine ??
        "I've finished preparing this package and it's ready for your judgment.",
      employeeSupportingParagraph:
        item.outcomeLine ?? "Your authorization is the last step before outreach can begin.",
    }
  }

  if ((item.kind === "lead_decision" || item.kind === "operator_focus") && company) {
    return {
      employeeHeadline: `I recommend finishing the research for ${company}.`,
      employeeLeadParagraph:
        item.supportingLine ??
        "I've already verified the company and collected most of the buying signals.",
      employeeSupportingParagraph:
        item.outcomeLine ??
        "Completing the remaining research will allow me to prepare an outreach package for your approval.",
    }
  }

  if (item.kind === "mission_discovery") {
    return {
      employeeHeadline: `I recommend ${item.headline.charAt(0).toLowerCase()}${item.headline.slice(1)}.`,
      employeeLeadParagraph: item.supportingLine ?? item.detail ?? "Your pipeline needs fresh qualified companies.",
      employeeSupportingParagraph:
        item.outcomeLine ?? "This keeps discovery aligned with your current revenue objective.",
    }
  }

  return {
    employeeHeadline: `I recommend ${item.headline.charAt(0).toLowerCase()}${item.headline.slice(1)}.`,
    employeeLeadParagraph: item.supportingLine ?? item.detail ?? "This is the next highest-value move in your queue.",
    employeeSupportingParagraph: item.outcomeLine,
  }
}

function buildExplanation(
  item: GrowthHomeAvaRecommendationItem,
  confidenceLabel: string | null,
): GrowthHomeAvaRecommendationExplanation {
  const whyChosen = item.whyReasons.filter(Boolean)
  if (whyChosen.length === 0 && item.supportingLine) whyChosen.push(item.supportingLine)
  if (whyChosen.length === 0 && item.detail) whyChosen.push(item.detail)

  return {
    whyChosen,
    expectedOutcome: expectedOutcomeForItem(item),
    estimatedEffortLabel: item.estimatedEffortLabel,
    postponementRisk: postponementRiskForKind(item.kind),
    confidenceLabel,
  }
}

export function enrichGrowthHomeAvaRecommendationItemNext1b(input: {
  item: GrowthHomeAvaRecommendationItem
  canonicalHeroDecision?: GrowthCanonicalDecisionResolution | null
}): GrowthHomeAvaRecommendationItem {
  const projection =
    input.canonicalHeroDecision?.decision &&
    input.item.leadId &&
    input.canonicalHeroDecision.leadId === input.item.leadId
      ? projectGrowthCanonicalOperatorDecision({
          decision: input.canonicalHeroDecision.decision,
          freshness: input.canonicalHeroDecision.freshness,
        })
      : null

  const thenActions = projection?.thenActions ?? []
  const confidenceLabel = projection?.confidenceLabel ?? input.item.detail?.match(/\d+%/)?.[0] ?? null
  let employeeCopy = buildEmployeeCopy(input.item)

  if (
    projection &&
    resolveMissionPhaseFromPrimaryAction(input.canonicalHeroDecision?.decision.primaryAction) === "research"
  ) {
    if (!employeeCopy.employeeLeadParagraph.includes("%")) {
      employeeCopy = {
        ...employeeCopy,
        employeeLeadParagraph:
          input.item.supportingLine ??
          projection.why[0] ??
          "I've already verified the company and collected most of the buying signals.",
      }
    }
  }

  const executionPathSteps = executionPathForKind(input.item.kind, thenActions)

  return {
    ...input.item,
    ...employeeCopy,
    expectedOutcomeLabel: expectedOutcomeForItem(input.item),
    executionPathSteps,
    explanation: buildExplanation(input.item, confidenceLabel),
  }
}

export function enrichGrowthHomeAvaRecommendationExperienceNext1b(input: {
  experience: GrowthHomeAvaRecommendationExperience
  canonicalHeroDecision?: GrowthCanonicalDecisionResolution | null
}): GrowthHomeAvaRecommendationExperience {
  return {
    ...input.experience,
    presentationQaMarker: GROWTH_AIOS_NEXT_1B_AVA_INTENT_RECOMMENDATION_QA_MARKER,
    recommendations: input.experience.recommendations.map((item) =>
      enrichGrowthHomeAvaRecommendationItemNext1b({
        item,
        canonicalHeroDecision: input.canonicalHeroDecision,
      }),
    ),
  }
}
