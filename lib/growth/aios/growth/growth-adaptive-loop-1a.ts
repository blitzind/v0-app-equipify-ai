/**
 * GE-AIOS-ADAPTIVE-LOOP-1A — Continuous relationship & strategy evolution (client-safe).
 * Reuses buildRelationshipAssessment → enrichOutreachSalesStrategyBrief — no duplicate engines.
 */

import type { GrowthOutreachLearningThemeWeight } from "@/lib/growth/aios/growth/growth-outreach-conversation-intelligence"
import { enrichOutreachSalesStrategyBrief } from "@/lib/growth/aios/growth/growth-outreach-conversation-intelligence"
import type { GrowthOutreachSalesStrategyBrief } from "@/lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import type { GrowthOutreachRevenueStrategyIntelligence } from "@/lib/growth/aios/growth/growth-outreach-revenue-strategy-intelligence"
import type { RevenueStrategyBuyingCommitteeSnapshot } from "@/lib/growth/aios/growth/growth-outreach-revenue-strategy-intelligence"
import {
  buildRelationshipAssessment,
  finalizeRelationshipAssessmentStrategyEvolution,
  type BuildRelationshipAssessmentInput,
} from "@/lib/growth/aios/growth/growth-relationship-strategy-2a"
import type {
  GrowthOutreachRelationshipAssessment,
  RelationshipAssessmentContextSignals,
  RelationshipAssessmentLeadSignals,
} from "@/lib/growth/aios/growth/growth-relationship-strategy-2a-types"
import type { GrowthLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-types"
import {
  ADAPTIVE_NEGATIVE_PROSPECT_EVENTS,
  ADAPTIVE_NEUTRAL_PROSPECT_EVENTS,
  ADAPTIVE_POSITIVE_PROSPECT_EVENTS,
  GROWTH_AIOS_ADAPTIVE_LOOP_1A_QA_MARKER,
  type AdaptiveLoopEvolutionSummary,
  type AdaptiveProspectEvent,
  type AdaptiveProspectEventCategory,
  type AdaptiveProspectEventType,
  type AdaptiveStrategyChangeDetection,
  type AdaptiveStrategySnapshot,
} from "@/lib/growth/aios/growth/growth-adaptive-loop-1a-types"

export {
  GROWTH_AIOS_ADAPTIVE_LOOP_1A_QA_MARKER,
  GROWTH_AIOS_ADAPTIVE_LOOP_1A_OPERATOR_LAYOUT_QA_MARKER,
  ADAPTIVE_POSITIVE_PROSPECT_EVENTS,
  ADAPTIVE_NEGATIVE_PROSPECT_EVENTS,
  ADAPTIVE_NEUTRAL_PROSPECT_EVENTS,
} from "@/lib/growth/aios/growth/growth-adaptive-loop-1a-types"

export type {
  AdaptiveProspectEvent,
  AdaptiveProspectEventType,
  AdaptiveLoopEvolutionSummary,
  AdaptiveStrategyChangeDetection,
} from "@/lib/growth/aios/growth/growth-adaptive-loop-1a-types"

const EVENT_OPERATOR_LABELS: Record<AdaptiveProspectEventType, string> = {
  reply_received: "New reply received",
  meeting_booked: "Meeting booked",
  meeting_completed: "Meeting completed",
  referral: "Referral received",
  champion_identified: "Champion identified",
  executive_engagement: "Executive engagement increased",
  proposal_requested: "Proposal requested",
  pricing_discussion: "Pricing discussion started",
  buying_committee_expansion: "Committee expanded",
  objection: "Objection raised",
  ghosting: "Momentum cooling",
  unsubscribe: "Unsubscribe signal",
  already_have_software: "Incumbent software objection",
  competitor_mentioned: "Competitor mentioned",
  budget_objection: "Budget objection",
  timing_objection: "Timing objection",
  relationship_deterioration: "Relationship deteriorating",
  contact_changed: "Contact changed",
  decision_maker_changed: "Decision maker changed",
  company_research_updated: "Company research updated",
  website_changes: "Website changes detected",
  funding: "Funding signal",
  acquisition: "Acquisition signal",
  organizational_changes: "Organizational changes",
}

export function resolveAdaptiveEventCategory(
  type: AdaptiveProspectEventType,
): AdaptiveProspectEventCategory {
  if ((ADAPTIVE_POSITIVE_PROSPECT_EVENTS as readonly string[]).includes(type)) return "positive"
  if ((ADAPTIVE_NEGATIVE_PROSPECT_EVENTS as readonly string[]).includes(type)) return "negative"
  return "neutral"
}

export function buildAdaptiveProspectEvent(input: {
  type: AdaptiveProspectEventType
  occurredAt: string
  summary: string
  detail?: string | null
}): AdaptiveProspectEvent {
  return {
    type: input.type,
    category: resolveAdaptiveEventCategory(input.type),
    occurredAt: input.occurredAt,
    summary: input.summary.trim(),
    detail: input.detail?.trim() ?? null,
  }
}

function uniquePush(lines: string[], next: string | null | undefined, limit = 6): string[] {
  const trimmed = next?.trim()
  if (!trimmed) return lines
  if (lines.some((line) => line.toLowerCase() === trimmed.toLowerCase())) return lines
  return [...lines, trimmed].slice(-limit)
}

export function applyAdaptiveProspectEventsToMemory(
  memory: GrowthLeadMemoryInfluenceContext | null | undefined,
  events: AdaptiveProspectEvent[],
): GrowthLeadMemoryInfluenceContext | null {
  if (!events.length) return memory ?? null
  const base: GrowthLeadMemoryInfluenceContext = memory?.available
    ? { ...memory }
    : {
        available: true,
        memoryCoverageScore: 35,
        relationshipStage: "aware",
        relationshipSummary: null,
        engagementTrend: null,
        progressionScore: null,
        topObjections: [],
        topPreferences: [],
        priorInteractionSummaries: [],
        commitmentSummaries: [],
        riskFlags: [],
        avoidRepeating: [],
        committeeContext: [],
        unresolvedObjectionCount: 0,
        unresolvedHighSeverityObjectionCount: 0,
      }

  let next = { ...base }
  for (const event of events) {
    const line = event.detail?.trim() || event.summary.trim()
    switch (event.type) {
      case "reply_received":
        next.priorInteractionSummaries = uniquePush(next.priorInteractionSummaries, line)
        next.relationshipStage = "engaged"
        next.engagementTrend = "improving"
        next.avoidRepeating = uniquePush(next.avoidRepeating, `Asked: ${line}`, 8)
        break
      case "meeting_booked":
      case "meeting_completed":
        next.commitmentSummaries = uniquePush(next.commitmentSummaries, line)
        next.relationshipStage = event.type === "meeting_completed" ? "evaluating" : "engaged"
        break
      case "champion_identified":
        next.committeeContext = uniquePush(next.committeeContext, `Champion: ${line}`)
        next.relationshipStage = "evaluating"
        break
      case "buying_committee_expansion":
        next.committeeContext = uniquePush(next.committeeContext, `Committee: ${line}`)
        break
      case "executive_engagement":
      case "proposal_requested":
      case "pricing_discussion":
      case "referral":
        next.commitmentSummaries = uniquePush(next.commitmentSummaries, line)
        next.relationshipStage = "opportunity"
        break
      case "objection":
      case "already_have_software":
      case "budget_objection":
      case "timing_objection":
      case "competitor_mentioned":
        next.topObjections = uniquePush(next.topObjections, line)
        next.unresolvedObjectionCount += 1
        if (event.type === "budget_objection" || event.type === "already_have_software") {
          next.unresolvedHighSeverityObjectionCount += 1
        }
        next.avoidRepeating = uniquePush(next.avoidRepeating, `Objection: ${line}`, 8)
        break
      case "ghosting":
      case "relationship_deterioration":
        next.riskFlags = uniquePush(next.riskFlags, line)
        next.engagementTrend = "cooling"
        break
      case "unsubscribe":
        next.riskFlags = uniquePush(next.riskFlags, "Unsubscribe requested.")
        break
      case "decision_maker_changed":
      case "contact_changed":
        next.committeeContext = uniquePush(next.committeeContext, line)
        break
      default:
        next.priorInteractionSummaries = uniquePush(next.priorInteractionSummaries, line)
        break
    }
  }

  next.memoryCoverageScore = Math.min(100, (next.memoryCoverageScore ?? 35) + events.length * 4)
  next.relationshipSummary =
    next.relationshipSummary ??
    (events[events.length - 1]
      ? `Relationship evolving — latest signal: ${events[events.length - 1]!.summary}`
      : null)

  return next
}

export function applyAdaptiveProspectEventsToContext(
  context: RelationshipAssessmentContextSignals,
  events: AdaptiveProspectEvent[],
): RelationshipAssessmentContextSignals {
  if (!events.length) return context

  let next = { ...context }
  for (const event of events) {
    const line = event.detail?.trim() || event.summary.trim()
    switch (event.type) {
      case "reply_received":
        next.priorReplySummaries = uniquePush(next.priorReplySummaries, line, 8)
        next.priorReplyCount = next.priorReplySummaries.length
        next.priorTouchCount = Math.max(next.priorTouchCount, next.priorReplyCount)
        break
      case "meeting_booked":
      case "meeting_completed":
      case "proposal_requested":
      case "pricing_discussion":
      case "referral":
      case "executive_engagement":
        next.priorReplySummaries = uniquePush(next.priorReplySummaries, line, 8)
        next.buyingIntent = line
        break
      case "objection":
      case "already_have_software":
      case "budget_objection":
      case "timing_objection":
        next.objectionSummaries = uniquePush(next.objectionSummaries, line, 8)
        break
      case "competitor_mentioned":
        next.competitorPressure = line
        next.objectionSummaries = uniquePush(next.objectionSummaries, line, 8)
        break
      case "ghosting":
      case "relationship_deterioration":
        next.sequenceHistorySummaries = uniquePush(next.sequenceHistorySummaries, line, 6)
        break
      case "buying_committee_expansion":
      case "champion_identified":
      case "decision_maker_changed":
        next.memoryOpenLoopSummaries = uniquePush(next.memoryOpenLoopSummaries, line, 6)
        break
      default:
        next.sequenceHistorySummaries = uniquePush(next.sequenceHistorySummaries, line, 6)
        break
    }
  }

  return next
}

export function applyAdaptiveProspectEventsToLeadSignals(
  lead: RelationshipAssessmentLeadSignals,
  events: AdaptiveProspectEvent[],
): RelationshipAssessmentLeadSignals {
  if (!events.length) return lead

  let next = { ...lead }
  for (const event of events) {
    switch (event.type) {
      case "reply_received":
      case "referral":
      case "champion_identified":
      case "executive_engagement":
        next.relationshipTrend = "warming"
        next.relationshipStrengthTier = next.relationshipStrengthTier ?? "warm"
        break
      case "meeting_booked":
      case "meeting_completed":
        next.hasMeetingScheduled = true
        next.relationshipTrend = "warming"
        break
      case "ghosting":
      case "relationship_deterioration":
        next.relationshipTrend = "cooling"
        next.sequenceFatigueRisk = "high"
        break
      case "unsubscribe":
        next.isSuppressed = true
        break
      case "objection":
      case "budget_objection":
      case "timing_objection":
      case "already_have_software":
        next.relationshipTrend = next.relationshipTrend ?? "stable"
        break
      default:
        break
    }
  }
  return next
}

export function applyAdaptiveProspectEventsToCommitteeSnapshot(
  snapshot: RevenueStrategyBuyingCommitteeSnapshot | null | undefined,
  events: AdaptiveProspectEvent[],
): RevenueStrategyBuyingCommitteeSnapshot | null {
  if (!events.length) return snapshot ?? null
  const base: RevenueStrategyBuyingCommitteeSnapshot = snapshot ?? {
    hasVerifiedCommittee: false,
    discoveryPending: true,
    discoveryFailed: false,
    singleThreadRisk: true,
    coverageScore: 0,
    rolesPresent: [],
    rolesMissing: ["champion", "economic_buyer"],
    verifiedMemberCount: 0,
  }

  let next = { ...base, rolesPresent: [...base.rolesPresent], rolesMissing: [...base.rolesMissing] }
  for (const event of events) {
    if (event.type === "buying_committee_expansion") {
      next.verifiedMemberCount = Math.max(next.verifiedMemberCount + 1, 1)
      next.hasVerifiedCommittee = next.verifiedMemberCount >= 2
      next.singleThreadRisk = next.verifiedMemberCount < 2
      next.coverageScore = Math.min(1, next.coverageScore + 0.12)
      if (!next.rolesPresent.includes("champion")) next.rolesPresent.push("champion")
      next.rolesMissing = next.rolesMissing.filter((role) => role !== "champion")
    }
    if (event.type === "champion_identified") {
      if (!next.rolesPresent.includes("champion")) next.rolesPresent.push("champion")
      next.rolesMissing = next.rolesMissing.filter((role) => role !== "champion")
      next.coverageScore = Math.min(1, next.coverageScore + 0.1)
    }
    if (event.type === "executive_engagement") {
      if (!next.rolesPresent.includes("economic_buyer")) next.rolesPresent.push("economic_buyer")
      next.rolesMissing = next.rolesMissing.filter((role) => role !== "economic_buyer")
    }
    if (event.type === "decision_maker_changed") {
      next.discoveryPending = false
      next.verifiedMemberCount = Math.max(next.verifiedMemberCount, 1)
    }
  }

  return next
}

export function buildAdaptiveRefreshReasonsFromEvents(events: AdaptiveProspectEvent[]): string[] {
  return events.map((event) => `adaptive_event:${event.type}`)
}

export function buildAdaptiveOperatorChangeLines(events: AdaptiveProspectEvent[]): string[] {
  return events.map((event) => EVENT_OPERATOR_LABELS[event.type] ?? event.type.replace(/_/g, " "))
}

function snapshotFromAssessment(
  assessment: GrowthOutreachRelationshipAssessment | null | undefined,
  revenue: GrowthOutreachRevenueStrategyIntelligence | null | undefined,
): AdaptiveStrategySnapshot {
  return {
    recommendation: revenue?.recommendation ?? null,
    relationshipGoal: assessment?.relationshipGoal.label ?? null,
    momentumTrend: assessment?.relationshipMomentum.trend ?? null,
    trustBudget: assessment?.trustBudget.level ?? null,
    relationshipConfidence: assessment?.relationshipConfidence.level ?? null,
  }
}

export function detectAdaptiveStrategyChanges(input: {
  previousAssessment?: GrowthOutreachRelationshipAssessment | null
  currentAssessment: GrowthOutreachRelationshipAssessment
  previousRevenue?: GrowthOutreachRevenueStrategyIntelligence | null
  currentRevenue?: GrowthOutreachRevenueStrategyIntelligence | null
  events: AdaptiveProspectEvent[]
}): AdaptiveStrategyChangeDetection {
  const previousStrategy = snapshotFromAssessment(input.previousAssessment, input.previousRevenue)
  const currentStrategy = snapshotFromAssessment(input.currentAssessment, input.currentRevenue)
  const relationshipChangedBecause = buildAdaptiveOperatorChangeLines(input.events)
  const meaningfulChanges: string[] = []

  if (
    previousStrategy.recommendation &&
    currentStrategy.recommendation &&
    previousStrategy.recommendation !== currentStrategy.recommendation
  ) {
    meaningfulChanges.push(
      `Revenue recommendation: ${previousStrategy.recommendation} → ${currentStrategy.recommendation}`,
    )
  }
  if (
    previousStrategy.relationshipGoal &&
    currentStrategy.relationshipGoal &&
    previousStrategy.relationshipGoal !== currentStrategy.relationshipGoal
  ) {
    meaningfulChanges.push(
      `Relationship goal: ${previousStrategy.relationshipGoal} → ${currentStrategy.relationshipGoal}`,
    )
  }
  if (
    previousStrategy.momentumTrend &&
    currentStrategy.momentumTrend &&
    previousStrategy.momentumTrend !== currentStrategy.momentumTrend
  ) {
    meaningfulChanges.push(`Momentum: ${previousStrategy.momentumTrend} → ${currentStrategy.momentumTrend}`)
  }
  if (
    previousStrategy.trustBudget &&
    currentStrategy.trustBudget &&
    previousStrategy.trustBudget !== currentStrategy.trustBudget
  ) {
    meaningfulChanges.push(`Trust budget: ${previousStrategy.trustBudget} → ${currentStrategy.trustBudget}`)
  }
  if (
    previousStrategy.relationshipConfidence &&
    currentStrategy.relationshipConfidence &&
    previousStrategy.relationshipConfidence !== currentStrategy.relationshipConfidence
  ) {
    meaningfulChanges.push(
      `Relationship confidence: ${previousStrategy.relationshipConfidence} → ${currentStrategy.relationshipConfidence}`,
    )
  }

  for (const line of input.currentAssessment.strategyEvolution.evolutionSummary) {
    if (!meaningfulChanges.includes(line)) meaningfulChanges.push(line)
  }

  return {
    relationshipChangedBecause,
    previousStrategy,
    currentStrategy,
    meaningfulChanges,
  }
}

export function applyLearningAdvisoryToRelationshipAssessment(
  assessment: GrowthOutreachRelationshipAssessment,
  learningWeights: GrowthOutreachLearningThemeWeight[] | null | undefined,
): GrowthOutreachRelationshipAssessment {
  if (!learningWeights?.length || !assessment.available) return assessment

  const weighted = learningWeights.filter((row) => row.sends >= 5)
  if (!weighted.length) return assessment

  const avgReply =
    weighted.reduce((sum, row) => sum + row.replyRatePct, 0) / Math.max(weighted.length, 1)
  const advisory =
    avgReply >= 12
      ? "Learning advisory: recent theme reply rates support a curiosity-led next touch."
      : avgReply <= 4
        ? "Learning advisory: recent learning outcomes suggest a lighter follow-up posture."
        : null

  if (!advisory) return assessment

  const scoreBoost = avgReply >= 12 ? 0.04 : avgReply <= 4 ? -0.03 : 0
  const nextScore = Math.max(0, Math.min(1, assessment.relationshipConfidence.score + scoreBoost))

  return {
    ...assessment,
    relationshipConfidence: {
      ...assessment.relationshipConfidence,
      score: nextScore,
      rationale: `${assessment.relationshipConfidence.rationale} ${advisory}`,
    },
  }
}

export type AdaptiveLoopPreparationInput = {
  events: AdaptiveProspectEvent[]
  memory: GrowthLeadMemoryInfluenceContext | null | undefined
  context: RelationshipAssessmentContextSignals
  lead: RelationshipAssessmentLeadSignals
  committee: RevenueStrategyBuyingCommitteeSnapshot | null | undefined
  assessmentInput: Omit<BuildRelationshipAssessmentInput, "memory" | "context" | "lead" | "refreshReasons">
  learningWeights?: GrowthOutreachLearningThemeWeight[] | null
  previousAssessment?: GrowthOutreachRelationshipAssessment | null
  previousRevenue?: GrowthOutreachRevenueStrategyIntelligence | null
  extraRefreshReasons?: string[]
}

export type AdaptiveLoopPreparationResult = {
  memory: GrowthLeadMemoryInfluenceContext | null
  context: RelationshipAssessmentContextSignals
  lead: RelationshipAssessmentLeadSignals
  committee: RevenueStrategyBuyingCommitteeSnapshot | null
  refreshReasons: string[]
  relationshipAssessment: GrowthOutreachRelationshipAssessment
  strategyChange: AdaptiveStrategyChangeDetection
}

export function applyAdaptiveLoopToOutreachPreparation(
  input: AdaptiveLoopPreparationInput,
): AdaptiveLoopPreparationResult {
  const memory = applyAdaptiveProspectEventsToMemory(input.memory, input.events)
  const context = applyAdaptiveProspectEventsToContext(input.context, input.events)
  const lead = applyAdaptiveProspectEventsToLeadSignals(input.lead, input.events)
  const committee = applyAdaptiveProspectEventsToCommitteeSnapshot(input.committee, input.events)
  const refreshReasons = [
    ...(input.extraRefreshReasons ?? []),
    ...buildAdaptiveRefreshReasonsFromEvents(input.events),
  ]

  let relationshipAssessment = buildRelationshipAssessment({
    ...input.assessmentInput,
    memory,
    context,
    lead,
    refreshReasons,
    previousRecommendation:
      input.previousRevenue?.recommendation ??
      input.previousAssessment?.strategyEvolution.previousRecommendation ??
      null,
    previousConfidence:
      input.previousRevenue?.confidenceScore ??
      input.previousAssessment?.previousStrategyConfidence ??
      null,
  })

  relationshipAssessment = applyLearningAdvisoryToRelationshipAssessment(
    relationshipAssessment,
    input.learningWeights,
  )

  const strategyChange = detectAdaptiveStrategyChanges({
    previousAssessment: input.previousAssessment,
    currentAssessment: relationshipAssessment,
    previousRevenue: input.previousRevenue,
    events: input.events,
  })

  return {
    memory,
    context,
    lead,
    committee,
    refreshReasons,
    relationshipAssessment,
    strategyChange,
  }
}

export function evolveOutreachStrategyFromAdaptiveEvents(input: {
  baseBrief: GrowthOutreachSalesStrategyBrief
  events: AdaptiveProspectEvent[]
  memory: GrowthLeadMemoryInfluenceContext | null | undefined
  context: RelationshipAssessmentContextSignals
  lead: RelationshipAssessmentLeadSignals
  committee: RevenueStrategyBuyingCommitteeSnapshot | null | undefined
  assessmentInput: Omit<BuildRelationshipAssessmentInput, "memory" | "context" | "lead" | "refreshReasons">
  learningWeights?: GrowthOutreachLearningThemeWeight[] | null
  enrichInput: Omit<Parameters<typeof enrichOutreachSalesStrategyBrief>[0], "brief" | "relationshipAssessment" | "leadMemory" | "buyingCommitteeSnapshot">
}): {
  brief: GrowthOutreachSalesStrategyBrief
  evolution: AdaptiveLoopEvolutionSummary
} {
  const adaptive = applyAdaptiveLoopToOutreachPreparation({
    events: input.events,
    memory: input.memory,
    context: input.context,
    lead: input.lead,
    committee: input.committee,
    assessmentInput: input.assessmentInput,
    learningWeights: input.learningWeights,
    previousAssessment: input.baseBrief.relationshipAssessment,
    previousRevenue: input.baseBrief.revenueStrategyIntelligence,
  })

  const enriched = enrichOutreachSalesStrategyBrief({
    ...input.enrichInput,
    brief: input.baseBrief,
    relationshipAssessment: adaptive.relationshipAssessment,
    leadMemory: adaptive.memory,
    buyingCommitteeSnapshot: adaptive.committee,
  })

  const relationshipAssessment = finalizeRelationshipAssessmentStrategyEvolution(
    enriched.relationshipAssessment ?? adaptive.relationshipAssessment,
    {
      currentRecommendation: enriched.revenueStrategyIntelligence?.recommendation ?? "research",
      currentConfidence: enriched.revenueStrategyIntelligence?.confidenceScore ?? input.baseBrief.confidence,
      previousRecommendation: input.baseBrief.revenueStrategyIntelligence?.recommendation ?? null,
      previousConfidence: input.baseBrief.revenueStrategyIntelligence?.confidenceScore ?? null,
      refreshReasons: adaptive.refreshReasons,
    },
  )

  const strategyChange = detectAdaptiveStrategyChanges({
    previousAssessment: input.baseBrief.relationshipAssessment,
    currentAssessment: relationshipAssessment,
    previousRevenue: input.baseBrief.revenueStrategyIntelligence,
    currentRevenue: enriched.revenueStrategyIntelligence,
    events: input.events,
  })

  const evolution: AdaptiveLoopEvolutionSummary = {
    qaMarker: GROWTH_AIOS_ADAPTIVE_LOOP_1A_QA_MARKER,
    eventCount: input.events.length,
    recentEvents: input.events,
    strategyChange,
    relationshipAssessment,
    learningAdvisoryApplied: Boolean(input.learningWeights?.length),
  }

  return {
    brief: {
      ...input.baseBrief,
      ...enriched,
      relationshipAssessment,
      adaptiveLoopEvolution: evolution,
    },
    evolution,
  }
}
