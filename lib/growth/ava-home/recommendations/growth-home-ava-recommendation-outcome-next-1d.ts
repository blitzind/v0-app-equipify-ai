/**
 * GE-AIOS-NEXT-1D — Outcome Builder (presentation-only).
 * Projects existing mission / decision / queue state into business outcomes.
 */

import type { GrowthCanonicalDecisionResolution } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import { projectGrowthCanonicalOperatorDecision } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-operator-projection"
import { resolveMissionPhaseFromPrimaryAction } from "@/lib/growth/aios/missions/growth-canonical-mission-1a-phases"
import type {
  GrowthHomeAvaRecommendationExperience,
  GrowthHomeAvaRecommendationItem,
  GrowthHomeAvaRecommendationKind,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1a-types"
import type { GrowthHomeAvaRecommendationExplanation } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1b-types"
import {
  GROWTH_AIOS_NEXT_1D_AVA_OUTCOME_PLANNING_QA_MARKER,
  type GrowthHomeAvaMissionHealthStatus,
  type GrowthHomeAvaRecommendationOutcomeProjection,
  type GrowthHomeAvaRecommendationOutcomeType,
  type GrowthHomeAvaRecommendationProgressMilestone,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-outcome-next-1d-types"
import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"

const RESEARCH_MILESTONE_LABELS = [
  "Research",
  "Decision maker",
  "Buying signals",
  "Package generation",
] as const

const MISSION_HEALTH_LABELS: Record<GrowthHomeAvaMissionHealthStatus, string> = {
  on_track: "On Track",
  needs_attention: "Needs Attention",
  blocked: "Blocked",
  waiting_on_you: "Waiting on You",
  waiting_on_customer: "Waiting on Customer",
  low_confidence: "Low Confidence",
}

function extractPercent(value: string | null | undefined): number | null {
  if (!value) return null
  const match = value.match(/(\d{1,3})\s*%/)
  if (!match) return null
  const parsed = Number.parseInt(match[1] ?? "", 10)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null
  return parsed
}

function buildResearchMilestones(percent: number | null): GrowthHomeAvaRecommendationProgressMilestone[] {
  const completeCount =
    percent == null ? 1 : percent >= 100 ? 4 : Math.max(1, Math.min(3, Math.ceil(percent / 25)))
  return RESEARCH_MILESTONE_LABELS.map((label, index) => ({
    label,
    complete: index < completeCount,
  }))
}

function buildProgressNarrative(input: {
  percent: number | null
  companyName: string | null
  prerequisites: string[]
  supportingLine: string | null
}): string | null {
  if (input.prerequisites[0]) {
    return input.prerequisites.length === 1
      ? input.prerequisites[0]
      : `${input.prerequisites[0]} and ${input.prerequisites.length - 1} more step${input.prerequisites.length - 1 === 1 ? "" : "s"} remain before I can prepare outreach.`
  }

  const percent = input.percent
  if (percent != null && percent > 0 && percent < 100) {
    const company = input.companyName ? ` for ${input.companyName}` : ""
    if (percent >= 75) {
      return `Research is nearly complete${company}. One buying signal remains before I can prepare outreach.`
    }
    if (percent >= 50) {
      return `Research is well underway${company}. A few buying signals still need verification.`
    }
    return `Research has started${company}. Most qualification work is still ahead.`
  }

  if (input.supportingLine && !/\d{1,3}\s*%/.test(input.supportingLine)) {
    return input.supportingLine
  }

  return null
}

function inferMissionHealth(input: {
  kind: GrowthHomeAvaRecommendationKind
  confidenceLabel: string | null
  transportBlocked: boolean
  pipelineLow: boolean
  lifecycleState?: GrowthHomeMissionDiscoverySnapshot["lifecycleState"] | null
}): GrowthHomeAvaMissionHealthStatus {
  if (input.kind === "approval_package" || input.kind === "waiting_on_you") {
    return "waiting_on_you"
  }
  if (input.transportBlocked) return "blocked"
  if (/low|weak|stale|degraded/i.test(input.confidenceLabel ?? "")) return "low_confidence"
  if (input.pipelineLow) return "needs_attention"
  if (input.lifecycleState === "waiting_for_approval") return "waiting_on_you"
  if (input.lifecycleState === "planning") return "needs_attention"
  return "on_track"
}

function outcomeTypeForItem(
  item: GrowthHomeAvaRecommendationItem,
  primaryAction: string | null,
): GrowthHomeAvaRecommendationOutcomeType {
  if (item.kind === "approval_package" || item.kind === "waiting_on_you") {
    return "prepare_opportunity_package"
  }
  if (item.kind === "mission_discovery") {
    if (/find more|discover|expand|pipeline/i.test(item.headline)) return "grow_qualified_pipeline"
    if (/research/i.test(item.headline)) return "prepare_opportunity_package"
    return "expand_approved_market"
  }
  if (item.kind === "work_manager") {
    if (/find|discover|hvac|companies|pipeline/i.test(item.headline)) return "grow_qualified_pipeline"
    if (/blocked|recover|resume|paused/i.test(item.headline)) return "recover_blocked_mission"
    if (/meeting|call|demo/i.test(item.headline)) return "increase_meetings"
    if (/outreach|send|email/i.test(item.headline)) return "launch_outreach"
  }
  if (item.kind === "supervised_sales") {
    if (/meeting|call|demo/i.test(item.headline)) return "increase_meetings"
    return "launch_outreach"
  }
  if (item.kind === "daily_queue") {
    if (/outreach|send|email|call/i.test(item.headline)) return "launch_outreach"
    if (/research|package|review/i.test(item.headline)) return "prepare_opportunity_package"
  }
  if (primaryAction && resolveMissionPhaseFromPrimaryAction(primaryAction) === "research") {
    return "prepare_opportunity_package"
  }
  if (primaryAction && /outreach|send|follow/i.test(primaryAction)) return "launch_outreach"
  if (/portfolio|quality|eligible/i.test(item.headline)) return "improve_portfolio_quality"
  if (/decision maker|contact|stakeholder/i.test(item.headline)) return "increase_decision_maker_confidence"
  return "prepare_opportunity_package"
}

function outcomeHeadlineForType(input: {
  outcomeType: GrowthHomeAvaRecommendationOutcomeType
  companyName: string | null
  item: GrowthHomeAvaRecommendationItem
}): string {
  const company = input.companyName?.trim()
  if (input.item.kind === "approval_package" || input.item.kind === "waiting_on_you") {
    return company
      ? "My recommendation is to approve the next opportunity so I can begin outreach."
      : "My recommendation is to approve the next opportunity so I can begin outreach."
  }
  switch (input.outcomeType) {
    case "grow_qualified_pipeline":
      return "My recommendation is to expand our qualified sales pipeline."
    case "prepare_opportunity_package":
      return company
        ? "My recommendation is to prepare another review-ready opportunity package."
        : "My recommendation is to prepare another review-ready opportunity package."
    case "launch_outreach":
      return "My recommendation is to begin conversations with our highest-confidence prospects."
    case "increase_meetings":
      return "My recommendation is to increase qualified meetings this week."
    case "improve_portfolio_quality":
      return "My recommendation is to improve portfolio quality before we expand outreach."
    case "increase_decision_maker_confidence":
      return company
        ? `My recommendation is to strengthen decision-maker confidence at ${company}.`
        : "My recommendation is to strengthen decision-maker confidence on our top account."
    case "expand_approved_market":
      return "My recommendation is to expand into an approved market segment."
    case "complete_mission":
      return "My recommendation is to complete the active mission objective."
    case "resume_paused_mission":
      return "My recommendation is to resume the paused mission."
    case "recover_blocked_mission":
      return "My recommendation is to recover the blocked mission work."
    default:
      return input.item.employeeHeadline ?? input.item.headline
  }
}

function nextStepLabelForItem(input: {
  item: GrowthHomeAvaRecommendationItem
  projectionWhatToDo: string | null
}): string | null {
  if (input.projectionWhatToDo) {
    return `The next step is ${input.projectionWhatToDo.charAt(0).toLowerCase()}${input.projectionWhatToDo.slice(1)}.`
  }
  if (input.item.kind === "approval_package") {
    return input.item.companyName
      ? `The next step is reviewing the opportunity package for ${input.item.companyName}.`
      : "The next step is reviewing the prepared opportunity package."
  }
  if (input.item.companyName && /research|finish|continue/i.test(input.item.headline)) {
    return `The next step is finishing the remaining research for ${input.item.companyName}.`
  }
  if (/find more|discover/i.test(input.item.headline)) {
    return `The next step is ${input.item.headline.charAt(0).toLowerCase()}${input.item.headline.slice(1)}.`
  }
  return input.item.title ? `The next step is ${input.item.title.charAt(0).toLowerCase()}${input.item.title.slice(1)}.` : null
}

function businessImpactForType(
  outcomeType: GrowthHomeAvaRecommendationOutcomeType,
  item: GrowthHomeAvaRecommendationItem,
): string {
  switch (outcomeType) {
    case "grow_qualified_pipeline":
      return item.outcomeLine ?? "Keeps pipeline coverage healthy so outreach does not stall."
    case "prepare_opportunity_package":
      return item.kind === "approval_package" || item.kind === "waiting_on_you"
        ? "Allows outreach to begin today once you approve."
        : "Adds another qualified opportunity ready for your review."
    case "launch_outreach":
      return "Moves qualified prospects into active conversations."
    case "increase_meetings":
      return "Converts pipeline momentum into live sales conversations."
    case "improve_portfolio_quality":
      return "Raises the quality of accounts before we invest more outreach effort."
    case "increase_decision_maker_confidence":
      return "Improves close probability on an active opportunity."
    case "expand_approved_market":
      return "Extends discovery into a market that fits your approved profile."
    case "complete_mission":
      return "Closes the loop on the current revenue objective."
    case "resume_paused_mission":
      return "Restores momentum on work that was already underway."
    case "recover_blocked_mission":
      return "Clears the blocker so the mission can progress again."
    default:
      return item.outcomeLine ?? "Moves today's revenue work forward."
  }
}

function remainingWorkForItem(input: {
  item: GrowthHomeAvaRecommendationItem
  prerequisites: string[]
  percent: number | null
}): string[] {
  if (input.prerequisites.length > 0) return input.prerequisites.slice(0, 3)
  if (input.item.kind === "approval_package" || input.item.kind === "waiting_on_you") {
    return ["Review the prepared package.", "Authorize outreach when ready."]
  }
  if (input.percent != null && input.percent > 0 && input.percent < 100) {
    const incomplete = buildResearchMilestones(input.percent)
      .filter((row) => !row.complete)
      .map((row) => row.label)
    if (incomplete[0]) {
      return [`Verify ${incomplete[0].toLowerCase()}.`]
    }
  }
  if (input.item.supportingLine) return [input.item.supportingLine]
  return []
}

export function buildGrowthHomeAvaRecommendationOutcomeProjection(input: {
  item: GrowthHomeAvaRecommendationItem
  canonicalHeroDecision?: GrowthCanonicalDecisionResolution | null
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
}): GrowthHomeAvaRecommendationOutcomeProjection {
  const projection =
    input.canonicalHeroDecision?.decision &&
    input.item.leadId &&
    input.canonicalHeroDecision.leadId === input.item.leadId
      ? projectGrowthCanonicalOperatorDecision({
          decision: input.canonicalHeroDecision.decision,
          freshness: input.canonicalHeroDecision.freshness,
        })
      : null

  const percent =
    extractPercent(input.item.supportingLine) ??
    extractPercent(input.item.detail) ??
    extractPercent(projection?.why[0] ?? null) ??
    extractPercent(input.item.explanation?.confidenceLabel ?? null)

  const outcomeType = outcomeTypeForItem(input.item, projection?.primaryAction ?? null)
  const confidenceLabel =
    projection?.confidenceLabel ?? input.item.explanation?.confidenceLabel ?? null
  const missionHealth = inferMissionHealth({
    kind: input.item.kind,
    confidenceLabel,
    transportBlocked: projection?.transportBlocked ?? false,
    pipelineLow: input.missionDiscovery?.pipelineLow ?? false,
    lifecycleState: input.missionDiscovery?.lifecycleState ?? null,
  })

  const why = (input.item.explanation?.whyChosen ?? input.item.whyReasons).filter(Boolean).slice(0, 4)
  const prerequisites = projection?.prerequisites ?? []
  const whatHappensNext =
    input.item.executionPathSteps ??
    projection?.thenActions ??
    (input.item.outcomeLine ? [input.item.outcomeLine] : [])

  const progressMilestones =
    outcomeType === "prepare_opportunity_package" && input.item.kind !== "approval_package"
      ? buildResearchMilestones(percent)
      : []

  return {
    qaMarker: GROWTH_AIOS_NEXT_1D_AVA_OUTCOME_PLANNING_QA_MARKER,
    outcomeType,
    outcomeHeadline: outcomeHeadlineForType({
      outcomeType,
      companyName: input.item.companyName,
      item: input.item,
    }),
    nextStepLabel: nextStepLabelForItem({
      item: input.item,
      projectionWhatToDo: projection?.whatToDo ?? null,
    }),
    why,
    currentProgressNarrative: buildProgressNarrative({
      percent,
      companyName: input.item.companyName,
      prerequisites,
      supportingLine: input.item.supportingLine,
    }),
    progressMilestones,
    progressPercent: percent,
    remainingWork: remainingWorkForItem({ item: input.item, prerequisites, percent }),
    expectedOutcome: input.item.explanation?.expectedOutcome ?? input.item.expectedOutcomeLabel ?? null,
    estimatedEffortLabel:
      input.item.explanation?.estimatedEffortLabel ?? input.item.estimatedEffortLabel ?? null,
    businessImpact: businessImpactForType(outcomeType, input.item),
    confidenceLabel,
    whatHappensNext: whatHappensNext.slice(0, 5),
    missionHealth,
    missionHealthLabel: MISSION_HEALTH_LABELS[missionHealth],
  }
}

function mergeExplanation(
  existing: GrowthHomeAvaRecommendationExplanation | undefined,
  outcome: GrowthHomeAvaRecommendationOutcomeProjection,
): GrowthHomeAvaRecommendationExplanation {
  return {
    whyChosen: outcome.why.length > 0 ? outcome.why : (existing?.whyChosen ?? []),
    expectedOutcome: outcome.expectedOutcome ?? existing?.expectedOutcome ?? null,
    estimatedEffortLabel: outcome.estimatedEffortLabel ?? existing?.estimatedEffortLabel ?? null,
    postponementRisk: existing?.postponementRisk ?? null,
    confidenceLabel: outcome.confidenceLabel ?? existing?.confidenceLabel ?? null,
  }
}

export function enrichGrowthHomeAvaRecommendationItemNext1d(input: {
  item: GrowthHomeAvaRecommendationItem
  canonicalHeroDecision?: GrowthCanonicalDecisionResolution | null
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
}): GrowthHomeAvaRecommendationItem {
  const outcome = buildGrowthHomeAvaRecommendationOutcomeProjection(input)

  return {
    ...input.item,
    employeeHeadline: outcome.outcomeHeadline,
    employeeLeadParagraph: outcome.nextStepLabel ?? input.item.employeeLeadParagraph ?? null,
    employeeSupportingParagraph:
      outcome.currentProgressNarrative ?? input.item.employeeSupportingParagraph ?? null,
    expectedOutcomeLabel: outcome.expectedOutcome,
    executionPathSteps: outcome.whatHappensNext,
    explanation: mergeExplanation(input.item.explanation, outcome),
    outcomeProjection: outcome,
  }
}

export function enrichGrowthHomeAvaRecommendationExperienceNext1d(input: {
  experience: GrowthHomeAvaRecommendationExperience
  canonicalHeroDecision?: GrowthCanonicalDecisionResolution | null
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
}): GrowthHomeAvaRecommendationExperience {
  return {
    ...input.experience,
    outcomeQaMarker: GROWTH_AIOS_NEXT_1D_AVA_OUTCOME_PLANNING_QA_MARKER,
    recommendations: input.experience.recommendations.map((item) =>
      enrichGrowthHomeAvaRecommendationItemNext1d({
        item,
        canonicalHeroDecision: input.canonicalHeroDecision,
        missionDiscovery: input.missionDiscovery,
      }),
    ),
  }
}
