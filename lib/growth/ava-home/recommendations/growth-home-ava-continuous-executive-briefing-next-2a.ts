/**
 * GE-AIOS-NEXT-2A — Continuous executive briefing synthesizer (presentation-only).
 * Compares acknowledged cursor baseline to current runtime read models — no new engines.
 */

import { buildSinceYesterdayLines } from "@/lib/growth/ava-home/narrative/context/ava-narrative-snapshot-memory"
import { pluralize } from "@/lib/growth/ava-home/narrative/copy/narrative-copy"
import type { AvaNarrativeMetricsSnapshot } from "@/lib/growth/ava-home/narrative/narrative-types"
import type { GrowthHomeAvaBusinessObjectiveLeadershipPayload } from "@/lib/growth/ava-home/recommendations/growth-home-ava-business-objective-next-1e-types"
import type { GrowthHomeAvaRecommendationExperience } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1a-types"
import type { GrowthHomeAvaRecommendationPreferenceRecord } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-preference-memory-next-1a"
import type { GrowthHomeAvaStrategicLeadershipPayload } from "@/lib/growth/ava-home/recommendations/growth-home-ava-strategic-leadership-next-1f-types"
import {
  buildGrowthHomeAvaExecutiveBriefingCursorSnapshot,
  hoursSinceIso,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-executive-briefing-cursor-next-2a"
import {
  GROWTH_AIOS_NEXT_2A_CONTINUOUS_BRIEFING_PRINCIPLE,
  GROWTH_AIOS_NEXT_2A_EXECUTIVE_BRIEFING_CURSOR_QA_MARKER,
  type GrowthHomeAvaContinuousExecutiveBriefingPayload,
  type GrowthHomeAvaExecutiveBriefingContinuousWorkStatus,
  type GrowthHomeAvaExecutiveBriefingCursor,
  type GrowthHomeAvaExecutiveBriefingCursorSnapshot,
  type GrowthHomeAvaExecutiveBriefingState,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-executive-briefing-cursor-next-2a-types"
import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import type { GrowthHomeSalesOutcomesPayload } from "@/lib/growth/specialists/execution/sales-outcome-types"

const MIN_MEANINGFUL_DELTA = 1

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const output: string[] = []
  for (const value of values) {
    const trimmed = value?.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    output.push(trimmed)
  }
  return output
}

function buildSinceLabel(input: {
  hoursSinceAcknowledgment: number | null
  lastMeaningfulInteractionKind: GrowthHomeAvaExecutiveBriefingCursor["lastMeaningfulInteractionKind"]
}): string {
  if (input.lastMeaningfulInteractionKind === "package_approved") return "Since your last approval"
  if (input.lastMeaningfulInteractionKind === "briefing_reviewed") return "Since your last review"
  if (input.hoursSinceAcknowledgment != null && input.hoursSinceAcknowledgment >= 8) {
    return "While you were away"
  }
  return "Since your last visit"
}

function buildOpeningLine(input: {
  greeting: string
  hoursSinceAcknowledgment: number | null
  hasOvernightWork: boolean
  isFirstBriefing: boolean
}): string {
  const nameMatch = input.greeting.match(/,\s*(.+?)\.?$/i)
  const name = nameMatch?.[1]?.trim()
  const salutation = name ? `Good ${timeOfDayLabel()}, ${name}.` : input.greeting

  if (input.isFirstBriefing) {
    return `${salutation} I've reviewed the current business state and established our starting baseline.`
  }
  if (input.hasOvernightWork) {
    return `${salutation} I've been working throughout the night.`
  }
  if (input.hoursSinceAcknowledgment != null && input.hoursSinceAcknowledgment < 1) {
    return "Welcome back."
  }
  if (input.hoursSinceAcknowledgment != null && input.hoursSinceAcknowledgment >= 8) {
    return `${salutation} Here's what changed while you were away.`
  }
  return `${salutation} Here's what changed since we last reviewed the business.`
}

function timeOfDayLabel(hour = new Date().getHours()): string {
  if (hour < 12) return "morning"
  if (hour < 17) return "afternoon"
  return "evening"
}

function buildActivityDeltas(input: {
  current: GrowthHomeAvaExecutiveBriefingCursorSnapshot
  baseline: GrowthHomeAvaExecutiveBriefingCursorSnapshot | null
  salesOutcomes: GrowthHomeSalesOutcomesPayload | null
}): {
  activitySummary: string[]
  improvedSummary: string[]
  declinedSummary: string[]
  completedSummary: string[]
  blockedSummary: string[]
} {
  if (!input.baseline) {
    return {
      activitySummary: [],
      improvedSummary: [],
      declinedSummary: [],
      completedSummary: [],
      blockedSummary: [],
    }
  }

  const activitySummary = buildSinceYesterdayLines(input.current, input.baseline)
  const improvedSummary: string[] = []
  const declinedSummary: string[] = []
  const completedSummary: string[] = []
  const blockedSummary: string[] = []

  const approvalDelta = input.current.pendingApprovals - input.baseline.pendingApprovals
  if (approvalDelta > 0) {
    activitySummary.push(
      `The approval backlog increased from ${input.baseline.pendingApprovals} to ${input.current.pendingApprovals}.`,
    )
    blockedSummary.push("Prepared packages are waiting for operator review.")
  } else if (approvalDelta < 0) {
    improvedSummary.push("The approval backlog decreased while you were away.")
  }

  const poolDelta = input.current.leadPoolVisible - input.baseline.leadPoolVisible
  if (poolDelta >= 5) {
    activitySummary.push(`Pipeline coverage expanded by ${poolDelta} visible companies.`)
    improvedSummary.push("Pipeline coverage improved.")
  } else if (poolDelta <= -5) {
    declinedSummary.push("Portfolio coverage declined since your last review.")
  }

  const objectiveDelta =
    input.current.objectiveProgressPercent != null && input.baseline.objectiveProgressPercent != null
      ? input.current.objectiveProgressPercent - input.baseline.objectiveProgressPercent
      : 0
  if (objectiveDelta >= 5) {
    improvedSummary.push("Our current objective advanced meaningfully.")
  }

  const summary = input.salesOutcomes?.dailySummary
  if (summary && summary.outreach_prepared > 0) {
    activitySummary.push(
      `I prepared ${summary.outreach_prepared} opportunity ${pluralize(summary.outreach_prepared, "package", "packages")}.`,
    )
  }
  if (summary && summary.qualified > 0) {
    activitySummary.push(`${summary.qualified} ${pluralize(summary.qualified, "account", "accounts")} met our qualification standard.`)
  }

  if (input.current.readyForReview > input.baseline.readyForReview) {
    improvedSummary.push("More opportunities reached review-ready status.")
  }

  return {
    activitySummary: uniqueStrings(activitySummary).slice(0, 8),
    improvedSummary: uniqueStrings(improvedSummary).slice(0, 4),
    declinedSummary: uniqueStrings(declinedSummary).slice(0, 4),
    completedSummary: uniqueStrings(completedSummary).slice(0, 4),
    blockedSummary: uniqueStrings(blockedSummary).slice(0, 4),
  }
}

function buildSelfEvaluationLines(input: {
  baseline: GrowthHomeAvaExecutiveBriefingCursorSnapshot | null
  current: GrowthHomeAvaExecutiveBriefingCursorSnapshot
  preferences: GrowthHomeAvaRecommendationPreferenceRecord[]
}): string[] {
  if (!input.baseline) return []

  const lastAccepted = [...input.preferences]
    .filter((row) => row.lastAcceptedAt)
    .sort((left, right) => Date.parse(right.lastAcceptedAt ?? "") - Date.parse(left.lastAcceptedAt ?? ""))[0]

  if (!lastAccepted?.lastAcceptedAt) return []

  const poolDelta = input.current.leadPoolVisible - input.baseline.leadPoolVisible
  const approvalDelta = input.current.pendingApprovals - input.baseline.pendingApprovals

  if (lastAccepted.kind === "mission_discovery" && poolDelta >= 5) {
    return [
      "Last time, I recommended increasing discovery. Pipeline coverage improved since then — that recommendation appears to have worked.",
    ]
  }

  if (lastAccepted.kind === "approval_package" && approvalDelta > 0) {
    return [
      "I recommended continuing research. Research progressed, but the approval backlog became the larger constraint. I would change today's priority.",
    ]
  }

  if (lastAccepted.kind === "lead_decision" && input.current.researched <= input.baseline.researched) {
    return [
      "I expected more research to finish, but decision-maker verification remains incomplete on some accounts. My earlier estimate was too optimistic.",
    ]
  }

  return []
}

function buildLearningLines(input: {
  strategicLeadership: GrowthHomeAvaStrategicLeadershipPayload | null
  missionDiscovery: GrowthHomeMissionDiscoverySnapshot | null
  approvalDelta: number
}): string[] {
  const lines: string[] = []
  if (input.approvalDelta >= 2) {
    lines.push("Approval latency is reducing throughput — packages are ready faster than they are being reviewed.")
  }
  if (input.missionDiscovery?.pipelineLow) {
    lines.push("Discovery yield needs replenishment before outreach can scale sustainably.")
  }
  if (input.strategicLeadership?.insight?.strategicMemoryLine) {
    lines.push(input.strategicLeadership.insight.strategicMemoryLine)
  }
  if (input.strategicLeadership?.insight && input.strategicLeadership.hasInsight) {
    lines.push(input.strategicLeadership.insight.observation)
  }
  return uniqueStrings(lines).slice(0, 4)
}

function resolveContinuousWorkStatus(input: {
  pendingApprovals: number
  missionDiscovery: GrowthHomeMissionDiscoverySnapshot | null
  outboundDisabled: boolean
  outboundWaitingForBusinessHours: boolean
}): { status: GrowthHomeAvaExecutiveBriefingContinuousWorkStatus; label: string; communicationNote: string | null } {
  if (input.outboundDisabled) {
    return {
      status: "outbound_disabled",
      label: "Discovery and research are continuing while external messaging is paused.",
      communicationNote: "No outreach was sent because outbound remains disabled.",
    }
  }
  if (input.outboundWaitingForBusinessHours) {
    return {
      status: "waiting_for_business_hours",
      label: "Internal work is continuing; outbound is queued for the next approved sending window.",
      communicationNote: "Outbound is queued for the next approved business-hour window.",
    }
  }
  if (input.pendingApprovals > 0) {
    return {
      status: "waiting_for_operator",
      label: "I'm waiting on operator review to keep qualified packages moving.",
      communicationNote: null,
    }
  }
  if (input.missionDiscovery?.lifecycleState === "researching") {
    return {
      status: "working_now",
      label: "Research continued according to existing runtime policy.",
      communicationNote: null,
    }
  }
  return {
    status: "working_now",
    label: "I'm continuing to monitor objectives and prepare recommendations.",
    communicationNote: null,
  }
}

function countMeaningfulChanges(input: {
  activitySummary: string[]
  improvedSummary: string[]
  declinedSummary: string[]
  blockedSummary: string[]
  completedSummary: string[]
}): number {
  return (
    input.activitySummary.length +
    input.improvedSummary.length +
    input.declinedSummary.length +
    input.blockedSummary.length +
    input.completedSummary.length
  )
}

export function buildGrowthHomeAvaContinuousExecutiveBriefingPayload(input: {
  greeting: string
  hour?: number
  cursor: GrowthHomeAvaExecutiveBriefingCursor
  metricsSnapshot: AvaNarrativeMetricsSnapshot
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
  businessObjectiveLeadership?: GrowthHomeAvaBusinessObjectiveLeadershipPayload | null
  recommendationExperience?: GrowthHomeAvaRecommendationExperience | null
  strategicLeadership?: GrowthHomeAvaStrategicLeadershipPayload | null
  salesOutcomes?: GrowthHomeSalesOutcomesPayload | null
  recommendationPreferences?: GrowthHomeAvaRecommendationPreferenceRecord[]
  pendingApprovals?: number
  outboundDisabled?: boolean
  outboundWaitingForBusinessHours?: boolean
  runtimeDegraded?: boolean
  generatedAt?: string
}): GrowthHomeAvaContinuousExecutiveBriefingPayload {
  const baseline = input.cursor.acknowledgedSnapshot
  const pendingApprovals = input.pendingApprovals ?? input.metricsSnapshot.approvalsWaiting
  const leadPoolVisible = input.missionDiscovery?.leadPoolVisible ?? 0
  const objectiveProgressPercent = input.businessObjectiveLeadership?.primaryObjective?.progressPercent ?? null
  const topRecommendationKind = input.recommendationExperience?.recommendations[0]?.kind ?? null

  const currentSnapshot = buildGrowthHomeAvaExecutiveBriefingCursorSnapshot({
    metricsSnapshot: input.metricsSnapshot,
    leadPoolVisible,
    pendingApprovals,
    objectiveProgressPercent,
    lastRecommendationKind: topRecommendationKind,
  })

  const hoursSinceAcknowledgment = hoursSinceIso(input.cursor.lastBriefingAcknowledgedAt)
  const hoursSinceMeaningful = hoursSinceIso(input.cursor.lastMeaningfulInteractionAt)
  const isFirstBriefing = !baseline
  const previousBriefingUnacknowledged = Boolean(
    input.cursor.lastBriefingGeneratedAt &&
      (!input.cursor.lastBriefingAcknowledgedAt ||
        Date.parse(input.cursor.lastBriefingGeneratedAt) > Date.parse(input.cursor.lastBriefingAcknowledgedAt)),
  )

  const approvalDelta = baseline ? pendingApprovals - baseline.pendingApprovals : 0
  const deltas = buildActivityDeltas({
    current: currentSnapshot,
    baseline,
    salesOutcomes: input.salesOutcomes ?? null,
  })
  const selfEvaluationLines = buildSelfEvaluationLines({
    baseline,
    current: currentSnapshot,
    preferences: input.recommendationPreferences ?? [],
  })
  const learningLines = buildLearningLines({
    strategicLeadership: input.strategicLeadership ?? null,
    missionDiscovery: input.missionDiscovery ?? null,
    approvalDelta,
  })

  const hasOvernightWork =
    !isFirstBriefing &&
    (hoursSinceAcknowledgment ?? 0) >= 8 &&
    countMeaningfulChanges(deltas) >= MIN_MEANINGFUL_DELTA

  const meaningfulChangeCount = countMeaningfulChanges(deltas)
  const hasMeaningfulChanges = !isFirstBriefing && meaningfulChangeCount >= MIN_MEANINGFUL_DELTA

  let state: GrowthHomeAvaExecutiveBriefingState = "no_meaningful_changes"
  if (isFirstBriefing) state = "first_briefing"
  else if (previousBriefingUnacknowledged) state = "previous_briefing_not_acknowledged"
  else if (input.runtimeDegraded) state = "runtime_degraded"
  else if (input.businessObjectiveLeadership?.primaryObjective?.completed) state = "objective_completed"
  else if (input.strategicLeadership?.recommendation) state = "strategic_recommendation_available"
  else if (input.outboundDisabled) state = "outbound_disabled"
  else if (input.outboundWaitingForBusinessHours) state = "outbound_waiting_for_business_hours"
  else if (hasOvernightWork) state = "overnight_work"
  else if ((hoursSinceMeaningful ?? 999) < 1 && !hasMeaningfulChanges) state = "short_return"
  else if (hasMeaningfulChanges) state = "meaningful_changes"

  const work = resolveContinuousWorkStatus({
    pendingApprovals,
    missionDiscovery: input.missionDiscovery ?? null,
    outboundDisabled: input.outboundDisabled ?? true,
    outboundWaitingForBusinessHours: input.outboundWaitingForBusinessHours ?? false,
  })

  const standoutLine =
    input.strategicLeadership?.insight?.observation ??
    (approvalDelta >= 2
      ? "Research throughput is healthy, but approvals are now the primary bottleneck."
      : null)

  const planAdjustmentLine =
    input.strategicLeadership?.recommendation?.summary ??
    input.recommendationExperience?.recommendations[0]?.outcomeProjection?.expectedOutcome ??
    null

  const objectiveStillCorrectLine = input.businessObjectiveLeadership?.primaryObjective
    ? input.businessObjectiveLeadership.primaryObjective.completed
      ? "We completed our current business objective."
      : input.businessObjectiveLeadership.primaryObjective.health === "ahead" ||
          input.businessObjectiveLeadership.primaryObjective.health === "on_track"
        ? "Our current objective remains on track."
        : input.businessObjectiveLeadership.primaryObjective.health === "waiting_on_you"
          ? "Our current objective is waiting on operator review to keep moving."
          : "Our current objective still needs attention."
    : null

  const openingLine = buildOpeningLine({
    greeting: input.greeting,
    hoursSinceAcknowledgment,
    hasOvernightWork,
    isFirstBriefing,
  })

  const activitySummary = isFirstBriefing
    ? ["I've established a baseline for future change comparisons."]
    : hasMeaningfulChanges
      ? deltas.activitySummary
      : [
          "Not much has changed since your last review.",
          "I'm continuing research and monitoring the active objective.",
          "I'll surface anything that requires your attention.",
        ]

  return {
    qaMarker: GROWTH_AIOS_NEXT_2A_EXECUTIVE_BRIEFING_CURSOR_QA_MARKER,
    principle: GROWTH_AIOS_NEXT_2A_CONTINUOUS_BRIEFING_PRINCIPLE,
    title: "Since You Were Last Here",
    state,
    openingLine,
    sinceLabel: buildSinceLabel({
      hoursSinceAcknowledgment,
      lastMeaningfulInteractionKind: input.cursor.lastMeaningfulInteractionKind,
    }),
    activitySummary,
    improvedSummary: deltas.improvedSummary,
    declinedSummary: deltas.declinedSummary,
    completedSummary: deltas.completedSummary,
    blockedSummary: deltas.blockedSummary,
    learningLines,
    selfEvaluationLines,
    planAdjustmentLine,
    standoutLine,
    objectiveStillCorrectLine,
    continuousWorkStatus: work.status,
    continuousWorkLabel: work.label,
    communicationNote: work.communicationNote,
    hasMeaningfulChanges,
    showAcknowledgeAction: Boolean(currentSnapshot),
    previousBriefingUnacknowledged,
    hoursSinceLastAcknowledgment: hoursSinceAcknowledgment,
    currentSnapshot,
  }
}
