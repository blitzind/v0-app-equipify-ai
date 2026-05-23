import { daysSince } from "@/lib/growth/engagement-decay"
import type {
  GrowthLeadOpportunityReadinessInput,
  GrowthOpportunityBlocker,
  GrowthOpportunityBlockerKey,
} from "@/lib/growth/opportunity-types"

const BLOCKER_LABELS: Record<GrowthOpportunityBlockerKey, string> = {
  missing_decision_maker: "Missing decision maker",
  low_engagement: "Low engagement",
  relationship_cooling: "Relationship cooling",
  no_phone: "No callable phone",
  insufficient_research: "Insufficient research",
  missing_website: "Missing website",
  suppressed: "Email suppressed",
  not_interested: "Not interested",
  long_inactivity: "Long inactivity",
  multiple_failed_attempts: "Multiple failed call attempts",
}

function trimPhone(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function deriveOpportunityBlockers(
  input: GrowthLeadOpportunityReadinessInput,
): GrowthOpportunityBlocker[] {
  const now = input.now ?? new Date()
  const blockers: GrowthOpportunityBlocker[] = []

  if (
    input.decisionMakerStatus === "none" ||
    input.decisionMakerStatus === "suspected" ||
    !input.decisionMakerStatus
  ) {
    blockers.push({ key: "missing_decision_maker", label: BLOCKER_LABELS.missing_decision_maker })
  }

  if (
    !input.engagementTier ||
    input.engagementTier === "cold" ||
    input.engagementTier === "warming"
  ) {
    blockers.push({ key: "low_engagement", label: BLOCKER_LABELS.low_engagement })
  }

  if (input.relationshipTrend === "cooling") {
    blockers.push({ key: "relationship_cooling", label: BLOCKER_LABELS.relationship_cooling })
  }

  if (!trimPhone(input.contactPhone) && !trimPhone(input.primaryDecisionMakerPhone)) {
    blockers.push({ key: "no_phone", label: BLOCKER_LABELS.no_phone })
  }

  if (!input.hasUsableResearch) {
    blockers.push({ key: "insufficient_research", label: BLOCKER_LABELS.insufficient_research })
  }

  if (!input.website?.trim()) {
    blockers.push({ key: "missing_website", label: BLOCKER_LABELS.missing_website })
  }

  if (input.isSuppressed) {
    blockers.push({ key: "suppressed", label: BLOCKER_LABELS.suppressed })
  }

  if (input.hasNotInterestedReply) {
    blockers.push({ key: "not_interested", label: BLOCKER_LABELS.not_interested })
  }

  const lastActivity =
    input.engagementLastActivityAt ??
    input.relationshipLastMeaningfulTouchAt ??
    input.lastHumanTouchAt
  if (!lastActivity || daysSince(lastActivity, now) > 45) {
    blockers.push({ key: "long_inactivity", label: BLOCKER_LABELS.long_inactivity })
  }

  const failedAttempts = input.callAttemptCount + input.voicemailCount
  if (failedAttempts >= 3 && input.connectedCallCount === 0) {
    blockers.push({ key: "multiple_failed_attempts", label: BLOCKER_LABELS.multiple_failed_attempts })
  }

  return blockers.sort((a, b) => a.key.localeCompare(b.key))
}
