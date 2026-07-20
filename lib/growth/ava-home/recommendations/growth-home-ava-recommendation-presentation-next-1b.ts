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
        ? `I found a strong fit at ${company}.`
        : "I found a company that looks like a strong match.",
      employeeLeadParagraph:
        item.supportingLine ??
        "I'd recommend reviewing the outreach package before I continue preparing the remaining opportunities.",
      employeeSupportingParagraph:
        item.outcomeLine ?? "Once you've reviewed it, I'll keep building the rest of today's pipeline.",
    }
  }

  if ((item.kind === "lead_decision" || item.kind === "operator_focus") && company) {
    return {
      employeeHeadline: `I found a strong fit at ${company}.`,
      employeeLeadParagraph:
        item.supportingLine ??
        "I'd recommend reviewing the outreach package before I continue preparing the remaining opportunities.",
      employeeSupportingParagraph:
        item.outcomeLine ??
        "If you'd like, I can finish the remaining research and prepare the package for your review.",
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
    employeeHeadline: item.headline.match(/^prepare another/i)
      ? "I found a company that looks like a strong match."
      : `I recommend ${item.headline.charAt(0).toLowerCase()}${item.headline.slice(1)}.`,
    employeeLeadParagraph:
      item.supportingLine ??
      item.detail ??
      "I'd recommend taking this step before I continue with the rest of today's plan.",
    employeeSupportingParagraph:
      item.outcomeLine ??
      "I'll keep the rest of the pipeline moving once you've had a chance to review.",
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
