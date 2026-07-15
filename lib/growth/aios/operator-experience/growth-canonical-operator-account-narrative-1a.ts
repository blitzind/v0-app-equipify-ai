/**
 * GE-AIOS-OPERATOR-STORY-IMPLEMENTATION-1A — Single authoritative account narrative (client-safe).
 */

import {
  applyCanonicalIdentityToCopy,
  resolveCanonicalCompanyDisplayName,
} from "@/lib/growth/aios/growth/growth-canonical-display-identity-1b"
import type { GrowthCanonicalOperatorDecisionProjection } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-operator-projection"
import type { GrowthCanonicalMission } from "@/lib/growth/aios/missions/growth-canonical-mission-1a-types"
import {
  humanizeOperatorDecisionTitle,
  humanizeOperatorFacingLine,
} from "@/lib/growth/aios/operator-experience/growth-operator-language-1a"
import type { GrowthCanonicalLeadOpportunityNarrative } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-types"
import { GROWTH_AIOS_OPERATOR_STORY_IMPLEMENTATION_1A_QA_MARKER } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-focus-1a-types"
import type { GrowthCanonicalOperatorAccountNarrative } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-account-narrative-1a-types"
import type { CanonicalHumanMemoryBundle } from "@/lib/growth/lead-memory/canonical-human-memory-types"

export type { GrowthCanonicalOperatorAccountNarrative } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-account-narrative-1a-types"

function pickWhatHappened(input: {
  memoryBundle?: CanonicalHumanMemoryBundle | null
  decision?: GrowthCanonicalOperatorDecisionProjection | null
  opportunityNarrative?: GrowthCanonicalLeadOpportunityNarrative | null
  mission?: GrowthCanonicalMission | null
  companyName: string
}): string {
  const memoryLine =
    input.memoryBundle?.relationship.summary?.trim() ||
    input.memoryBundle?.influence.relationshipSummary?.trim() ||
    input.memoryBundle?.relationship.meetingHistory?.[0]?.trim() ||
    null

  if (memoryLine) {
    return humanizeOperatorFacingLine(memoryLine)
  }

  if (input.mission?.currentObjective?.trim()) {
    return humanizeOperatorFacingLine(input.mission.currentObjective)
  }

  if (input.decision?.why[0]?.trim()) {
    return humanizeOperatorFacingLine(input.decision.why[0])
  }

  if (input.opportunityNarrative?.why?.trim()) {
    return humanizeOperatorFacingLine(input.opportunityNarrative.why)
  }

  return `I'm building context on ${input.companyName}.`
}

export function buildCanonicalOperatorAccountNarrative(input: {
  leadId: string
  companyName: string
  memoryBundle?: CanonicalHumanMemoryBundle | null
  decision?: GrowthCanonicalOperatorDecisionProjection | null
  opportunityNarrative?: GrowthCanonicalLeadOpportunityNarrative | null
  mission?: GrowthCanonicalMission | null
}): GrowthCanonicalOperatorAccountNarrative {
  const identity = input.memoryBundle?.identity ?? null
  const companyDisplayName = resolveCanonicalCompanyDisplayName(identity, input.companyName)

  const opportunity = input.opportunityNarrative
  const currentFocus = opportunity
    ? opportunity.currentFocus
    : input.mission?.currentObjective
      ? humanizeOperatorFacingLine(input.mission.currentObjective)
      : input.decision
        ? humanizeOperatorDecisionTitle(input.decision.whatToDo, input.decision.primaryAction)
        : `Work ${companyDisplayName}`

  const nextStep = opportunity
    ? opportunity.nextStep
    : input.mission?.nextOperatorAction?.trim() ||
      input.mission?.nextAvaAction?.trim() ||
      (input.decision
        ? humanizeOperatorDecisionTitle(input.decision.whatToDo, input.decision.primaryAction)
        : "Continue qualification research")

  const rawWhatHappened = pickWhatHappened({
    memoryBundle: input.memoryBundle,
    decision: input.decision,
    opportunityNarrative: opportunity,
    mission: input.mission,
    companyName: companyDisplayName,
  })

  const whatHappened = identity
    ? applyCanonicalIdentityToCopy(rawWhatHappened, identity)
    : rawWhatHappened

  const evidence = [
    ...(opportunity?.evidence ?? []).slice(0, 3),
    ...(input.decision?.why ?? []).slice(0, 2).map(humanizeOperatorFacingLine),
    input.memoryBundle?.relationship.stage
      ? `Relationship stage: ${input.memoryBundle.relationship.stage}`
      : null,
  ]
    .filter((row): row is string => Boolean(row?.trim()))
    .filter((row, index, all) => all.indexOf(row) === index)
    .slice(0, 4)

  return {
    qaMarker: GROWTH_AIOS_OPERATOR_STORY_IMPLEMENTATION_1A_QA_MARKER,
    leadId: input.leadId,
    companyDisplayName,
    whatHappened,
    currentFocus: identity
      ? applyCanonicalIdentityToCopy(currentFocus, identity)
      : currentFocus,
    nextStep: identity ? applyCanonicalIdentityToCopy(nextStep, identity) : nextStep,
    evidence,
    decisionFingerprint:
      input.decision?.decisionFingerprint ??
      input.mission?.decisionFingerprint ??
      opportunity?.decisionFingerprint ??
      null,
    identity,
  }
}
