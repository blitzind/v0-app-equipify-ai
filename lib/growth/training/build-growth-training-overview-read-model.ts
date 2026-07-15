/** GE-AIOS-19C-2E — Training Overview read model (client-safe, no fabricated scores). */

import type { BusinessProfileRecord } from "@/lib/growth/business-profile/business-profile-types"
import type { GrowthHomeOrganizationalKnowledgePayload } from "@/lib/growth/memory/knowledge/organization-knowledge-types"
import {
  filterValidatedInstitutionalLearnings,
  GROWTH_INSTITUTIONAL_LEARNING_EMPTY_MESSAGE,
} from "@/lib/growth/memory/institutional-learning/growth-institutional-learning-truthfulness-1a"
import type { GrowthHomeLaunchMissionSetupViewModel } from "@/lib/growth/workspace/executive-briefing/growth-home-launch-mission-setup-synthesizer"
import { evaluateBusinessStrategyCompleteness } from "@/lib/growth/training/evaluate-business-strategy-completeness"
import {
  GROWTH_TRAINING_BUSINESS_STRATEGY_ROUTE,
  GROWTH_TRAINING_COMPANY_PROFILE_ROUTE,
  GROWTH_TRAINING_LEARNED_ROUTE,
  GROWTH_TRAINING_RUNBOOK_ROUTE,
  GROWTH_TRAINING_WORKSPACE_19C_QA_MARKER,
  type GrowthTrainingOverviewReadModel,
} from "@/lib/growth/training/growth-training-workspace-types"

export type BuildGrowthTrainingOverviewInput = {
  activeApproved: BusinessProfileRecord | null
  latestDraft: BusinessProfileRecord | null
  organizationalKnowledge: GrowthHomeOrganizationalKnowledgePayload | null
  launchSetup: GrowthHomeLaunchMissionSetupViewModel | null
}

function resolveProfileRecord(input: BuildGrowthTrainingOverviewInput): BusinessProfileRecord | null {
  return input.latestDraft ?? input.activeApproved
}

function buildCompanyProfileArea(input: BuildGrowthTrainingOverviewInput) {
  if (input.activeApproved) {
    const missing = input.activeApproved.profile.confidence.missingInformation.filter(Boolean)
    return {
      id: "company_profile" as const,
      label: "Company Profile",
      status: missing.length > 0 ? ("in_progress" as const) : ("complete" as const),
      summary: "I understand the factual description of your business.",
      href: GROWTH_TRAINING_COMPANY_PROFILE_ROUTE,
      coachingHint:
        missing.length > 0
          ? `I'm still learning: ${missing.slice(0, 3).join(", ")}`
          : null,
    }
  }
  if (input.latestDraft) {
    return {
      id: "company_profile" as const,
      label: "Company Profile",
      status: "in_progress" as const,
      summary: "You have a draft Company Profile waiting for approval.",
      href: GROWTH_TRAINING_COMPANY_PROFILE_ROUTE,
      coachingHint: "Approve your Company Profile so I can use it confidently.",
    }
  }
  return {
    id: "company_profile" as const,
    label: "Company Profile",
    status: "not_started" as const,
    summary: "I don't know your company facts yet.",
    href: GROWTH_TRAINING_COMPANY_PROFILE_ROUTE,
    coachingHint: "Start with who you are — industry, services, and ideal customers.",
  }
}

function buildBusinessStrategyArea(input: BuildGrowthTrainingOverviewInput) {
  const record = resolveProfileRecord(input)
  const strategy = record?.profile.businessStrategy
  const completeness = evaluateBusinessStrategyCompleteness(strategy)

  if (input.activeApproved && completeness.hasContent) {
    return {
      id: "business_strategy" as const,
      label: "Business Strategy",
      status: completeness.missingAreas.length > 0 ? ("in_progress" as const) : ("complete" as const),
      summary: "I know how you want me to think and communicate.",
      href: GROWTH_TRAINING_BUSINESS_STRATEGY_ROUTE,
      coachingHint:
        completeness.missingAreas.length > 0
          ? `I'd improve fastest if you taught me: ${completeness.missingAreas.slice(0, 3).join(", ")}`
          : null,
    }
  }
  if (input.latestDraft?.profile.businessStrategy && completeness.hasContent) {
    return {
      id: "business_strategy" as const,
      label: "Business Strategy",
      status: "in_progress" as const,
      summary: "You have strategy updates in a draft profile.",
      href: GROWTH_TRAINING_BUSINESS_STRATEGY_ROUTE,
      coachingHint: "Approve your profile draft so I can apply your strategy.",
    }
  }
  return {
    id: "business_strategy" as const,
    label: "Business Strategy",
    status: "not_started" as const,
    summary: "I haven't learned your positioning, messaging, or pricing philosophy yet.",
    href: GROWTH_TRAINING_BUSINESS_STRATEGY_ROUTE,
    coachingHint: "Teach me how you think — tone, objections, and qualification standards.",
  }
}

function buildRunbookArea(launchSetup: GrowthHomeLaunchMissionSetupViewModel | null) {
  if (!launchSetup) {
    return {
      id: "runbook" as const,
      label: "Runbook",
      status: "not_started" as const,
      summary: "Operating procedures are not configured yet.",
      href: GROWTH_TRAINING_RUNBOOK_ROUTE,
      coachingHint: "Set up approvals, autonomy, and operating procedures.",
    }
  }

  const incompleteSteps = launchSetup.steps.filter((step) => step.status !== "complete")
  if (launchSetup.setupComplete) {
    return {
      id: "runbook" as const,
      label: "Runbook",
      status: "complete" as const,
      summary: "Your operating procedures and readiness checks are in place.",
      href: GROWTH_TRAINING_RUNBOOK_ROUTE,
      coachingHint: null,
    }
  }

  const nextStep = incompleteSteps[0]
  return {
    id: "runbook" as const,
    label: "Runbook",
    status: "in_progress" as const,
    summary: `${launchSetup.completedStepCount} of ${launchSetup.totalStepCount} operating steps complete.`,
    href: GROWTH_TRAINING_RUNBOOK_ROUTE,
    coachingHint: nextStep ? `Next: ${nextStep.label}` : "Finish operating setup in Runbook.",
  }
}

function buildLearnedArea(organizationalKnowledge: GrowthHomeOrganizationalKnowledgePayload | null) {
  const count = filterValidatedInstitutionalLearnings(organizationalKnowledge?.store.items).length

  if (count === 0) {
    return {
      id: "learned" as const,
      label: "What I've Learned",
      status: "not_started" as const,
      summary: GROWTH_INSTITUTIONAL_LEARNING_EMPTY_MESSAGE,
      href: GROWTH_TRAINING_LEARNED_ROUTE,
      coachingHint: "Validated learnings appear here after outcomes and approved intelligence.",
    }
  }

  return {
    id: "learned" as const,
    label: "What I've Learned",
    status: "available" as const,
    summary: `${count} validated conclusion${count === 1 ? "" : "s"} from your operating history.`,
    href: GROWTH_TRAINING_LEARNED_ROUTE,
    coachingHint: null,
  }
}

export function buildGrowthTrainingOverviewReadModel(
  input: BuildGrowthTrainingOverviewInput,
): GrowthTrainingOverviewReadModel {
  const areas = [
    buildCompanyProfileArea(input),
    buildBusinessStrategyArea(input),
    buildRunbookArea(input.launchSetup),
    buildLearnedArea(input.organizationalKnowledge),
  ]

  const wellUnderstood = areas
    .filter((area) => area.status === "complete" || area.status === "available")
    .map((area) => area.label)

  const needsCoaching = areas
    .flatMap((area) => (area.coachingHint ? [area.coachingHint] : []))
    .slice(0, 5)

  const priorityArea =
    areas.find((area) => area.status === "not_started") ??
    areas.find((area) => area.status === "in_progress") ??
    null

  const profileConfidence = input.activeApproved?.profile.confidence.score
  const confidenceNote =
    typeof profileConfidence === "number" && profileConfidence > 0
      ? `Company Profile confidence comes from your approved profile (${profileConfidence}/100). Strategy and runbook readiness use setup state — not a separate scoring engine.`
      : "Training readiness reflects approved profile state, strategy content, operating setup, and earned knowledge — not fabricated percentages."

  let headline = "I'm still learning your business."
  if (input.activeApproved && areas.every((area) => area.status === "complete" || area.status === "available")) {
    headline = "I understand your business well."
  } else if (input.activeApproved) {
    headline = "I'm building a strong understanding of your business."
  }

  return {
    qaMarker: GROWTH_TRAINING_WORKSPACE_19C_QA_MARKER,
    headline,
    subheadline: priorityArea?.coachingHint ?? null,
    wellUnderstood,
    needsCoaching,
    recommendedNextAction: priorityArea
      ? {
          label: `Continue ${priorityArea.label}`,
          href: priorityArea.href,
          reason: priorityArea.coachingHint ?? priorityArea.summary,
        }
      : null,
    areas,
    confidenceNote,
  }
}
