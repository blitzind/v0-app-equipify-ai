/**
 * GE-AIOS-RELATIONSHIP-STRATEGY-2A — Canonical relationship assessment (client-safe).
 * One computed root; all relationship projections derive from existing memory signals.
 */

import { mergeMemoryObjectionSummaries } from "@/lib/growth/lead-memory/memory-influence-projection"
import type { GrowthLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-types"
import type { RevenueStrategyRecommendation } from "@/lib/growth/aios/growth/growth-outreach-revenue-strategy-intelligence"
import {
  GROWTH_AIOS_RELATIONSHIP_STRATEGY_2A_QA_MARKER,
  RELATIONSHIP_GOAL_LABELS,
  type BuildRelationshipAssessmentInput,
  type GrowthOutreachInstitutionalAdviceSnippet,
  type GrowthOutreachRelationshipAssessment,
  type GrowthOutreachRelationshipGoal,
  type GrowthOutreachRelationshipMomentum,
  type GrowthOutreachRelationshipProtection,
  type GrowthOutreachRelationshipStory,
  type GrowthOutreachSafeRecallItem,
  type RelationshipAssessmentContextSignals,
  type RelationshipConfidenceLevel,
  type RelationshipDirection,
  type RelationshipGoalKey,
  type RelationshipImprovementOutlook,
  type RelationshipMomentumTrend,
  type RelationshipProtectionAction,
  type SafeRecallSource,
  type TrustBudgetLevel,
} from "@/lib/growth/aios/growth/growth-relationship-strategy-2a-types"

export type {
  BuildRelationshipAssessmentInput,
  GrowthOutreachInstitutionalAdviceSnippet,
  GrowthOutreachRelationshipAssessment,
  GrowthOutreachRelationshipGoal,
  GrowthOutreachRelationshipMomentum,
  GrowthOutreachRelationshipProtection,
  GrowthOutreachRelationshipStory,
  GrowthOutreachSafeRecallItem,
  RelationshipAssessmentContextSignals,
  RelationshipAssessmentLeadSignals,
} from "@/lib/growth/aios/growth/growth-relationship-strategy-2a-types"

export { GROWTH_AIOS_RELATIONSHIP_STRATEGY_2A_QA_MARKER, RELATIONSHIP_GOAL_LABELS } from "@/lib/growth/aios/growth/growth-relationship-strategy-2a-types"

const TIMESTAMP_PATTERNS = [
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/gi,
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi,
  /\b\d+\s+(days?|weeks?|months?|years?)\s+ago\b/gi,
  /\bthree months ago\b/gi,
  /\blast (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
]

const CREEPY_PATTERNS = [
  /\bour system\b/i,
  /\bwe tracked\b/i,
  /\baccording to our records\b/i,
  /\bconfidence score\b/i,
  /\bai\b/i,
  /\bcrawler\b/i,
  /\bautomation\b/i,
]

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function clamp100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function uniqueLines(lines: Array<string | null | undefined>, limit = 8): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of lines) {
    const trimmed = line?.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase().slice(0, 80)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
    if (out.length >= limit) break
  }
  return out
}

function stripUnsafeRecallText(text: string): string {
  let cleaned = text.trim()
  for (const pattern of TIMESTAMP_PATTERNS) {
    cleaned = cleaned.replace(pattern, "")
  }
  for (const pattern of CREEPY_PATTERNS) {
    cleaned = cleaned.replace(pattern, "")
  }
  return cleaned.replace(/\s+/g, " ").trim()
}

function compactTopic(text: string, max = 72): string {
  let topic = stripUnsafeRecallText(text)
  topic = topic.replace(/^(asked for|requested|mentioned|noted|discussed|promised to|send|share)\s+/i, "")
  if (topic.length <= max) return topic
  const cut = topic.slice(0, max - 1)
  const space = cut.lastIndexOf(" ")
  return `${(space > 20 ? cut.slice(0, space) : cut).trim()}…`
}

function naturalRecallPhrase(topic: string, source: SafeRecallSource): string {
  const lower = topic.charAt(0).toLowerCase() + topic.slice(1)
  switch (source) {
    case "commitment":
      return `Following through on ${lower}`
    case "objection":
      return `Keeping this focused on ${lower}`
    case "meeting":
      return `Building on what we covered around ${lower}`
    case "preference":
      return `Respecting your preference on ${lower}`
    case "reply":
      return `Last time we talked about ${lower}`
    default:
      return `Picking up on ${lower}`
  }
}

export function buildSafeRecallItems(input: {
  memory: GrowthLeadMemoryInfluenceContext
  context: RelationshipAssessmentContextSignals
}): GrowthOutreachSafeRecallItem[] {
  const items: GrowthOutreachSafeRecallItem[] = []

  const push = (raw: string, source: SafeRecallSource, freshnessWeight: number) => {
    const topic = compactTopic(raw)
    if (!topic || topic.length < 8) return
    const naturalPhrase = naturalRecallPhrase(topic, source)
    if (CREEPY_PATTERNS.some((pattern) => pattern.test(naturalPhrase))) return
    items.push({
      topic,
      naturalPhrase,
      source,
      confidence: input.memory.memoryCoverageScore != null && input.memory.memoryCoverageScore >= 60 ? "high" : "medium",
      freshnessWeight,
    })
  }

  for (const entry of input.memory.topObjections.slice(0, 2)) {
    push(entry, "objection", 0.85)
  }
  for (const entry of input.memory.commitmentSummaries.slice(0, 2)) {
    push(entry, "commitment", 0.95)
  }
  for (const entry of input.context.memoryOpenLoopSummaries.slice(0, 2)) {
    push(entry, "reply", 0.9)
  }
  for (const entry of input.context.priorReplySummaries.slice(0, 2)) {
    push(entry, "reply", 0.8)
  }
  for (const entry of input.memory.topPreferences.slice(0, 1)) {
    push(entry, "preference", 0.75)
  }
  for (const entry of input.memory.priorInteractionSummaries.slice(0, 1)) {
    push(entry, "interaction", 0.7)
  }

  const seen = new Set<string>()
  return items.filter((item) => {
    const key = item.topic.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 4)
}

export function extractAnsweredThemes(input: {
  memory: GrowthLeadMemoryInfluenceContext
  context: RelationshipAssessmentContextSignals
  safeRecall: GrowthOutreachSafeRecallItem[]
}): string[] {
  const themes = [
    ...input.safeRecall.map((row) => row.topic),
    ...input.memory.avoidRepeating,
    ...input.context.priorOutboundSubjects,
    ...input.context.sequenceHistorySummaries,
    ...input.context.objectionSummaries,
    ...input.context.priorReplySummaries,
  ]
  return uniqueLines(
    themes.map((line) => line.replace(/subject:\s*/i, "").trim()),
    12,
  ).map((line) => line.toLowerCase())
}

function deriveRelationshipDirection(input: {
  memory: GrowthLeadMemoryInfluenceContext
  lead: BuildRelationshipAssessmentInput["lead"]
}): RelationshipDirection {
  const trend = (input.lead.relationshipTrend ?? input.memory.engagementTrend ?? "").toLowerCase()
  if (trend === "cooling" || trend === "declining") return "cooling"
  if (trend === "improving") return "warming"
  if (input.lead.isSuppressed || input.lead.leadStatus === "dormant") return "dormant"
  if (input.memory.relationshipStage === "inactive") return "dormant"
  if (trend === "stable") return "stable"
  return "unknown"
}

function deriveTrustBudget(input: {
  memory: GrowthLeadMemoryInfluenceContext
  context: RelationshipAssessmentContextSignals
  lead: BuildRelationshipAssessmentInput["lead"]
}): { level: TrustBudgetLevel; score: number; rationale: string[] } {
  const rationale: string[] = []
  let score = 55

  if (input.context.priorReplyCount > 0) {
    score += 15
    rationale.push("Prospect has replied — trust is building.")
  }
  if (input.memory.unresolvedHighSeverityObjectionCount > 0) {
    score -= 18
    rationale.push("Unresolved high-severity objection on file.")
  }
  if (input.context.priorTouchCount >= 3 && input.context.priorReplyCount === 0) {
    score -= 22
    rationale.push("Multiple touches without a reply — trust is being consumed.")
  }
  if (input.context.priorTouchCount >= 5 && input.context.priorReplyCount === 0) {
    score -= 20
    rationale.push("Repeated unanswered outreach — credibility risk is elevated.")
  }
  if ((input.lead.relationshipTrend ?? "").toLowerCase() === "cooling") {
    score -= 15
    rationale.push("Relationship trend is cooling.")
  }
  if (input.lead.isSuppressed) {
    score -= 40
    rationale.push("Contact is suppressed — trust is depleted.")
  }
  if (input.lead.sequenceFatigueRisk === "high") {
    score -= 12
    rationale.push("Sequence fatigue risk is high.")
  }
  if (input.memory.commitmentSummaries.length > 0) {
    score += 8
    rationale.push("Open commitments indicate ongoing engagement.")
  }

  score = clamp100(score)
  let level: TrustBudgetLevel = "maintaining"
  if (score >= 72) level = "building"
  else if (score >= 52) level = "maintaining"
  else if (score >= 35) level = "consuming"
  else if (score >= 18) level = "damaging"
  else level = "depleted"

  if (rationale.length === 0) {
    rationale.push("Limited relationship history — default to cautious trust posture.")
  }

  return { level, score, rationale }
}

function deriveMomentum(input: {
  memory: GrowthLeadMemoryInfluenceContext
  context: RelationshipAssessmentContextSignals
  lead: BuildRelationshipAssessmentInput["lead"]
  direction: RelationshipDirection
}): GrowthOutreachRelationshipMomentum {
  const signals: string[] = []
  let score = 20

  if (input.context.priorReplyCount > 0) {
    score += 20 + Math.min(20, input.context.priorReplyCount * 8)
    signals.push(`${input.context.priorReplyCount} prior repl${input.context.priorReplyCount === 1 ? "y" : "ies"}`)
  }
  if (input.lead.hasMeetingScheduled) {
    score += 18
    signals.push("Meeting scheduled")
  }
  if ((input.memory.committeeContext?.length ?? 0) > 0) {
    score += 10
    signals.push("Committee context on file")
  }
  if (input.memory.progressionScore != null) {
    score += Math.min(15, Math.round(input.memory.progressionScore / 8))
  }
  if (input.context.priorTouchCount >= 3 && input.context.priorReplyCount === 0) {
    score -= 15
    signals.push("Ghosting risk — touches without replies")
  }
  if (input.direction === "cooling") {
    score -= 20
    signals.push("Relationship cooling")
  }
  if (input.memory.unresolvedObjectionCount > 0) {
    score -= 8
    signals.push(`${input.memory.unresolvedObjectionCount} unresolved objection(s)`)
  }
  if (input.context.buyingIntent && /positive|high|strong/i.test(input.context.buyingIntent)) {
    score += 12
    signals.push("Positive buying intent detected")
  }

  score = clamp100(score)
  let trend: RelationshipMomentumTrend = "steady"
  if (input.direction === "warming" || score >= 65) trend = "accelerating"
  else if (input.direction === "cooling" || (input.context.priorTouchCount >= 3 && input.context.priorReplyCount === 0)) {
    trend = input.direction === "cooling" ? "reversing" : "stalling"
  } else if (score < 35) {
    trend = "stalling"
  }

  return { score, trend, signals: uniqueLines(signals, 6) }
}

function deriveRelationshipConfidence(input: {
  memory: GrowthLeadMemoryInfluenceContext
  lead: BuildRelationshipAssessmentInput["lead"]
}): { level: RelationshipConfidenceLevel; score: number; rationale: string } {
  let score =
    (input.memory.memoryCoverageScore ?? 0) * 0.45 +
    (input.lead.relationshipStrengthScore ?? 0) * 0.35 +
    (input.memory.unresolvedObjectionCount === 0 ? 12 : 0)

  if (!input.memory.available) score = Math.min(score, 25)
  score = clamp100(score)

  let level: RelationshipConfidenceLevel = "unknown"
  if (score >= 82) level = "very_high"
  else if (score >= 65) level = "high"
  else if (score >= 45) level = "moderate"
  else if (score >= 20) level = "low"

  const rationale = input.memory.available
    ? `Memory coverage ${input.memory.memoryCoverageScore ?? 0}% with ${input.memory.priorInteractionSummaries.length} interaction signal(s) on file.`
    : "No durable relationship memory — treat as a new relationship."

  return { level, score, rationale }
}

function deriveRelationshipGoal(input: {
  memory: GrowthLeadMemoryInfluenceContext
  context: RelationshipAssessmentContextSignals
  lead: BuildRelationshipAssessmentInput["lead"]
  trustBudget: TrustBudgetLevel
  momentum: GrowthOutreachRelationshipMomentum
  direction: RelationshipDirection
  protection: GrowthOutreachRelationshipProtection
}): GrowthOutreachRelationshipGoal {
  let current: RelationshipGoalKey = "build_credibility"
  let rationale = "Default to credibility-building until the relationship proves engagement."
  let successCriteria = "Earn a substantive reply or meeting interest."
  let progress = 0.15
  let completed = false
  let nextGoal: RelationshipGoalKey | null = "validate_operational_pain"

  if (input.protection.action === "walk_away" || input.lead.isSuppressed) {
    current = "walk_away"
    rationale = "Suppression or disqualification signals — protect the brand by stepping back."
    successCriteria = "Close the loop respectfully without further pursuit."
    progress = 1
    completed = true
    nextGoal = null
  } else if (input.protection.active && input.trustBudget === "depleted") {
    current = "protect_relationship"
    rationale = "Trust is depleted — the next move must protect credibility, not push for a meeting."
    successCriteria = "Pause outreach until a natural re-entry signal appears."
    progress = 0.8
    nextGoal = "recover_trust"
  } else if (input.direction === "cooling" && input.context.priorReplyCount > 0) {
    current = "recover_trust"
    rationale = "Relationship is cooling after prior engagement — rebuild trust before advancing."
    successCriteria = "Re-open dialogue with value, not another pitch."
    progress = 0.45
    nextGoal = "validate_operational_pain"
  } else if (input.lead.hasMeetingScheduled) {
    current = "prepare_executive_conversation"
    rationale = "A meeting is on the calendar — prepare a focused executive conversation."
    successCriteria = "Confirm attendees, agenda, and a clear next step after the meeting."
    progress = 0.7
    nextGoal = "support_opportunity"
  } else if (input.memory.relationshipStage === "opportunity" || input.memory.relationshipStage === "evaluating") {
    current = "support_opportunity"
    rationale = "Relationship has reached evaluating/opportunity stage — support progression."
    successCriteria = "Advance discovery and align stakeholders on next step."
    progress = 0.75
    nextGoal = "expand_committee"
  } else if ((input.memory.committeeContext?.length ?? 0) === 0 && (input.lead.committeeMemberCount ?? 0) < 2) {
    current = "expand_committee"
    rationale = "Single-thread risk — expand committee coverage before relying on one contact."
    successCriteria = "Identify at least one additional stakeholder role."
    progress = 0.35
    nextGoal = "identify_champion"
  } else if ((input.memory.committeeContext?.length ?? 0) > 0 && !input.memory.committeeContext.some((line) => /champion|decision/i.test(line))) {
    current = "identify_champion"
    rationale = "Committee context exists but no champion is clear yet."
    successCriteria = "Surface an internal advocate who cares about the workflow outcome."
    progress = 0.4
    nextGoal = "support_opportunity"
  } else if (input.context.priorReplyCount > 0 && input.momentum.trend !== "reversing") {
    current = "validate_operational_pain"
    rationale = "Prospect has engaged — validate the operational pain before proposing next steps."
    successCriteria = "Confirm the workflow friction and who owns the problem."
    progress = 0.6
    nextGoal = "support_opportunity"
  } else if (input.context.priorTouchCount > 0 && input.context.priorReplyCount === 0) {
    current = "earn_first_reply"
    rationale = "Outreach has started but no reply yet — earn the first meaningful response."
    successCriteria = "Receive any substantive reply that opens dialogue."
    progress = Math.min(0.55, 0.2 + input.context.priorTouchCount * 0.08)
    nextGoal = "build_credibility"
  } else if (input.trustBudget === "building" || input.trustBudget === "maintaining") {
    current = "build_credibility"
    rationale = "Early relationship — lead with curiosity and evidence, not a product tour."
    successCriteria = "Establish that outreach is relevant and respectful of their time."
    progress = 0.25
    nextGoal = "earn_first_reply"
  }

  if (input.context.priorReplyCount > 0 && current === "earn_first_reply") {
    completed = true
    current = "validate_operational_pain"
    rationale = "First reply achieved — shift to validating operational pain."
    progress = 0.55
    nextGoal = "support_opportunity"
  }

  return {
    current,
    label: RELATIONSHIP_GOAL_LABELS[current],
    rationale,
    successCriteria,
    progress: clamp01(progress),
    completed,
    nextGoal,
  }
}

function deriveRelationshipProtection(input: {
  memory: GrowthLeadMemoryInfluenceContext
  context: RelationshipAssessmentContextSignals
  lead: BuildRelationshipAssessmentInput["lead"]
  trustBudget: TrustBudgetLevel
  direction: RelationshipDirection
}): GrowthOutreachRelationshipProtection {
  const rationale: string[] = []
  let action: RelationshipProtectionAction = "none"

  if (input.lead.isSuppressed) {
    action = "walk_away"
    rationale.push("Contact is suppressed.")
  } else if (input.trustBudget === "depleted") {
    action = "pause"
    rationale.push("Trust budget depleted — pause outreach.")
  } else if (input.trustBudget === "damaging") {
    action = "protect_credibility"
    rationale.push("Further outreach likely damages credibility.")
  } else if (input.direction === "cooling" && input.context.priorTouchCount >= 3) {
    action = "delay"
    rationale.push("Relationship cooling after multiple touches.")
  } else if (input.context.priorTouchCount >= 5 && input.context.priorReplyCount === 0) {
    action = "wait"
    rationale.push("Five or more touches without a reply — wait before another attempt.")
  } else if (input.lead.sequenceFatigueRisk === "high") {
    action = "protect_credibility"
    rationale.push("Sequence fatigue is high.")
  } else if (input.memory.unresolvedHighSeverityObjectionCount > 0 && input.context.priorReplyCount > 0) {
    action = "recover_trust"
    rationale.push("Unresolved high-severity objection requires trust recovery first.")
  }

  return {
    action,
    rationale,
    active: action !== "none",
  }
}

function deriveImprovementLikelihood(input: {
  trustBudget: TrustBudgetLevel
  momentum: GrowthOutreachRelationshipMomentum
  protection: GrowthOutreachRelationshipProtection
  goal: RelationshipGoalKey
}): {
  ifProceed: RelationshipImprovementOutlook
  ifDelay: RelationshipImprovementOutlook
  rationale: string[]
} {
  const rationale: string[] = []
  let ifProceed: RelationshipImprovementOutlook = "neutral"
  let ifDelay: RelationshipImprovementOutlook = "neutral"

  if (input.protection.active || input.trustBudget === "depleted" || input.trustBudget === "damaging") {
    ifProceed = "weaken"
    ifDelay = "improve"
    rationale.push("Proceeding now would likely weaken the relationship — waiting may rebuild trust.")
  } else if (input.momentum.trend === "accelerating") {
    ifProceed = "improve"
    ifDelay = "neutral"
    rationale.push("Momentum is accelerating — a well-aligned next touch can improve the relationship.")
  } else if (input.momentum.trend === "stalling" || input.momentum.trend === "reversing") {
    ifProceed = "weaken"
    ifDelay = "improve"
    rationale.push("Momentum is stalling — patience may outperform another push.")
  } else if (input.goal === "earn_first_reply" || input.goal === "build_credibility") {
    ifProceed = "improve"
    rationale.push("Early-stage goal — thoughtful outreach can build the relationship.")
  }

  if (rationale.length === 0) {
    rationale.push("Relationship impact is neutral without stronger engagement signals.")
  }

  return { ifProceed, ifDelay, rationale }
}

function deriveRelationshipPrediction(input: {
  direction: RelationshipDirection
  momentum: GrowthOutreachRelationshipMomentum
  improvement: { ifProceed: RelationshipImprovementOutlook }
}): GrowthOutreachRelationshipAssessment["relationshipPrediction"] {
  let likelyNextState = input.direction
  if (input.improvement.ifProceed === "improve" && input.momentum.trend === "accelerating") {
    likelyNextState = "warming"
  } else if (input.improvement.ifProceed === "weaken") {
    likelyNextState = "cooling"
  }

  const improveLikelihood =
    input.improvement.ifProceed === "improve" ? 0.68 : input.improvement.ifProceed === "neutral" ? 0.45 : 0.18
  const weakenLikelihood =
    input.improvement.ifProceed === "weaken" ? 0.72 : input.improvement.ifProceed === "neutral" ? 0.25 : 0.1
  const stallLikelihood = clamp01(1 - improveLikelihood - weakenLikelihood * 0.5)

  return {
    likelyNextState,
    improveLikelihood: clamp01(improveLikelihood),
    stallLikelihood: clamp01(stallLikelihood),
    weakenLikelihood: clamp01(weakenLikelihood),
  }
}

function buildRelationshipStory(input: {
  companyName: string
  memory: GrowthLeadMemoryInfluenceContext
  context: RelationshipAssessmentContextSignals
  lead: BuildRelationshipAssessmentInput["lead"]
  goal: GrowthOutreachRelationshipGoal
  direction: RelationshipDirection
  trustBudget: TrustBudgetLevel
  momentum: GrowthOutreachRelationshipMomentum
  safeRecall: GrowthOutreachSafeRecallItem[]
}): GrowthOutreachRelationshipStory {
  const sections: GrowthOutreachRelationshipStory["sections"] = []

  const originLines = uniqueLines([
    input.context.priorTouchCount === 0
      ? `Relationship with ${input.companyName} is new — no prior outreach recorded.`
      : `Relationship with ${input.companyName} began with research-led outreach.`,
    input.memory.relationshipSummary,
  ], 3)
  sections.push({ key: "origin", label: "How it started", lines: originLines })

  sections.push({
    key: "conversations",
    label: "Important conversations",
    lines: uniqueLines([...input.memory.priorInteractionSummaries, ...input.context.priorReplySummaries], 4),
  })

  sections.push({
    key: "promises",
    label: "Promises & open loops",
    lines: uniqueLines(input.memory.commitmentSummaries, 3),
  })

  sections.push({
    key: "objections",
    label: "Known objections",
    lines: uniqueLines(input.memory.topObjections, 3),
  })

  sections.push({
    key: "signals",
    label: "Buying signals",
    lines: uniqueLines(
      [
        input.context.buyingIntent ? `Buying intent: ${input.context.buyingIntent}` : null,
        input.lead.hasMeetingScheduled ? "Meeting scheduled." : null,
        ...input.memory.commitmentSummaries.filter((line) => /meeting|demo|pricing|timeline/i.test(line)),
      ],
      4,
    ),
  })

  sections.push({
    key: "committee",
    label: "Committee evolution",
    lines: uniqueLines(input.memory.committeeContext, 3),
  })

  sections.push({
    key: "trust",
    label: "Trust evolution",
    lines: uniqueLines(
      [
        `Trust budget: ${input.trustBudget}.`,
        `Momentum: ${input.momentum.trend} (${input.momentum.score}/100).`,
        input.lead.relationshipTrend ? `Relationship trend: ${input.lead.relationshipTrend}.` : null,
      ],
      4,
    ),
  })

  const recommendedDirection =
    input.goal.completed && input.goal.nextGoal
      ? `Advance from ${input.goal.label.toLowerCase()} toward ${RELATIONSHIP_GOAL_LABELS[input.goal.nextGoal].toLowerCase()}.`
      : `Focus on ${input.goal.label.toLowerCase()} — ${input.goal.rationale}`

  const essentials = uniqueLines(
    [
      originLines[0] ?? null,
      input.memory.topObjections[0] ? `Objection on file: ${compactTopic(input.memory.topObjections[0], 90)}` : null,
      input.safeRecall[0]?.naturalPhrase ?? null,
      `Goal: ${input.goal.label}`,
      `Direction: ${input.direction}`,
      `Trust: ${input.trustBudget}`,
      recommendedDirection,
    ],
    7,
  )

  const summary = uniqueLines(
    [
      originLines[0] ?? null,
      input.context.priorReplyCount > 0 ? "Prospect has engaged in prior dialogue." : null,
      input.memory.topObjections[0] ? `Outstanding concern: ${compactTopic(input.memory.topObjections[0], 80)}.` : null,
      `Current focus: ${input.goal.label.toLowerCase()}.`,
      recommendedDirection,
    ],
    5,
  ).join(" ")

  return { summary, sections, essentials, recommendedDirection }
}

function deriveStrategyEvolution(input: {
  refreshReasons: string[]
  previousRecommendation: RevenueStrategyRecommendation | string | null | undefined
  currentRecommendation?: RevenueStrategyRecommendation | string | null
  previousConfidence?: number | null
  currentConfidence?: number | null
}): GrowthOutreachRelationshipAssessment["strategyEvolution"] {
  const previous = input.previousRecommendation ?? null
  const current = input.currentRecommendation ?? null
  const recommendationChanged = Boolean(previous && current && previous !== current)
  const confidenceDelta =
    input.previousConfidence != null && input.currentConfidence != null
      ? Math.round((input.currentConfidence - input.previousConfidence) * 100) / 100
      : null

  const evolutionSummary: string[] = []
  const whyChanged: string[] = []

  if (recommendationChanged) {
    evolutionSummary.push(`Recommendation shifted from ${previous} to ${current}.`)
    whyChanged.push("Relationship signals changed since the last outreach package.")
  } else if (previous) {
    evolutionSummary.push(`Recommendation unchanged (${current ?? previous}).`)
  }

  if (confidenceDelta != null && Math.abs(confidenceDelta) >= 0.05) {
    evolutionSummary.push(
      `Confidence ${confidenceDelta > 0 ? "increased" : "decreased"} by ${Math.abs(Math.round(confidenceDelta * 100))} points.`,
    )
  }

  for (const reason of input.refreshReasons) {
    whyChanged.push(`Triggered by ${reason.replace(/_/g, " ")}.`)
  }

  return {
    refreshReasons: input.refreshReasons,
    previousRecommendation: previous,
    recommendationChanged,
    evolutionSummary,
    confidenceDelta,
    whyChanged,
  }
}

function emptyAssessment(companyName: string): GrowthOutreachRelationshipAssessment {
  const goal: GrowthOutreachRelationshipGoal = {
    current: "build_credibility",
    label: RELATIONSHIP_GOAL_LABELS.build_credibility,
    rationale: "No relationship memory — treat as a new account and build credibility first.",
    successCriteria: "Earn relevance before asking for time.",
    progress: 0.1,
    completed: false,
    nextGoal: "earn_first_reply",
  }

  return {
    qaMarker: GROWTH_AIOS_RELATIONSHIP_STRATEGY_2A_QA_MARKER,
    available: false,
    relationshipStory: {
      summary: `${companyName} has no recorded relationship history yet.`,
      sections: [],
      essentials: ["New relationship — no prior memory on file."],
      recommendedDirection: "Lead with curiosity and evidence, not a product pitch.",
    },
    relationshipGoal: goal,
    relationshipDirection: "unknown",
    relationshipMomentum: { score: 15, trend: "steady", signals: [] },
    trustBudget: { level: "maintaining", score: 50, rationale: ["No relationship history — default cautious posture."] },
    relationshipConfidence: { level: "unknown", score: 0, rationale: "No memory coverage." },
    relationshipImprovementLikelihood: {
      ifProceed: "neutral",
      ifDelay: "neutral",
      rationale: ["Insufficient relationship history for prediction."],
    },
    relationshipPrediction: {
      likelyNextState: "unknown",
      improveLikelihood: 0.4,
      stallLikelihood: 0.4,
      weakenLikelihood: 0.2,
    },
    strategyEvolution: {
      refreshReasons: [],
      previousRecommendation: null,
      recommendationChanged: false,
      evolutionSummary: [],
      confidenceDelta: null,
      whyChanged: [],
    },
    safeRecall: [],
    relationshipProtection: { action: "none", rationale: [], active: false },
    institutionalAdvice: [],
    answeredThemes: [],
    memoryFreshnessWeight: 0,
    previousStrategyConfidence: null,
  }
}

export function buildRelationshipAssessment(
  input: BuildRelationshipAssessmentInput,
): GrowthOutreachRelationshipAssessment {
  const memory = input.memory
  if (!memory?.available) {
    return emptyAssessment(input.companyName)
  }

  const safeRecall = buildSafeRecallItems({ memory, context: input.context })
  const answeredThemes = extractAnsweredThemes({ memory, context: input.context, safeRecall })
  const direction = deriveRelationshipDirection({ memory, lead: input.lead })
  const trust = deriveTrustBudget({ memory, context: input.context, lead: input.lead })
  const momentum = deriveMomentum({ memory, context: input.context, lead: input.lead, direction })
  const confidence = deriveRelationshipConfidence({ memory, lead: input.lead })
  const protection = deriveRelationshipProtection({
    memory,
    context: input.context,
    lead: input.lead,
    trustBudget: trust.level,
    direction,
  })
  const goal = deriveRelationshipGoal({
    memory,
    context: input.context,
    lead: input.lead,
    trustBudget: trust.level,
    momentum,
    direction,
    protection,
  })
  const improvement = deriveImprovementLikelihood({
    trustBudget: trust.level,
    momentum,
    protection,
    goal: goal.current,
  })
  const prediction = deriveRelationshipPrediction({ direction, momentum, improvement })
  const relationshipStory = buildRelationshipStory({
    companyName: input.companyName,
    memory,
    context: input.context,
    lead: input.lead,
    goal,
    direction,
    trustBudget: trust.level,
    momentum,
    safeRecall,
  })

  const memoryFreshnessWeight = clamp01(
    (memory.memoryCoverageScore ?? 0) / 100 * 0.6 +
      (input.context.priorReplyCount > 0 ? 0.25 : 0) +
      (memory.commitmentSummaries.length > 0 ? 0.15 : 0),
  )

  return {
    qaMarker: GROWTH_AIOS_RELATIONSHIP_STRATEGY_2A_QA_MARKER,
    available: true,
    relationshipStory,
    relationshipGoal: goal,
    relationshipDirection: direction,
    relationshipMomentum: momentum,
    trustBudget: trust,
    relationshipConfidence: confidence,
    relationshipImprovementLikelihood: improvement,
    relationshipPrediction: prediction,
    strategyEvolution: deriveStrategyEvolution({
      refreshReasons: input.refreshReasons ?? [],
      previousRecommendation: input.previousRecommendation,
      currentRecommendation: null,
      previousConfidence: input.previousConfidence,
      currentConfidence: input.currentConfidence,
    }),
    safeRecall,
    relationshipProtection: protection,
    institutionalAdvice: input.institutionalAdvice ?? [],
    answeredThemes,
    memoryFreshnessWeight,
    previousStrategyConfidence: input.previousConfidence ?? null,
  }
}

export function finalizeRelationshipAssessmentStrategyEvolution(
  assessment: GrowthOutreachRelationshipAssessment,
  input: {
    currentRecommendation: RevenueStrategyRecommendation
    currentConfidence: number
    previousRecommendation?: RevenueStrategyRecommendation | string | null
    previousConfidence?: number | null
    refreshReasons?: string[]
  },
): GrowthOutreachRelationshipAssessment {
  return {
    ...assessment,
    strategyEvolution: deriveStrategyEvolution({
      refreshReasons: input.refreshReasons ?? assessment.strategyEvolution.refreshReasons,
      previousRecommendation: input.previousRecommendation ?? assessment.strategyEvolution.previousRecommendation,
      currentRecommendation: input.currentRecommendation,
      previousConfidence: input.previousConfidence ?? assessment.previousStrategyConfidence,
      currentConfidence: input.currentConfidence,
    }),
  }
}

export function mergeRelationshipMemoryObjections(
  existing: Array<{ objection: string; response: string }>,
  memory: GrowthLeadMemoryInfluenceContext | null | undefined,
): Array<{ objection: string; response: string }> {
  if (!memory?.available) return existing
  const mergedLabels = mergeMemoryObjectionSummaries(
    existing.map((row) => row.objection),
    memory,
  )
  const seen = new Set(existing.map((row) => row.objection.toLowerCase()))
  const extra = mergedLabels
    .filter((label) => !seen.has(label.toLowerCase().slice(0, 80)))
    .slice(0, 3)
    .map((objection) => ({
      objection: objection.split(":")[0]?.trim() || objection,
      response:
        "Acknowledge it directly, return to the specific workflow outcome, and keep the next step small.",
    }))
  return [...existing, ...extra].slice(0, 6)
}

export function relationshipAssessmentSuggestsDelay(
  assessment: GrowthOutreachRelationshipAssessment | null | undefined,
): boolean {
  if (!assessment?.available) return false
  if (assessment.relationshipProtection.active) return true
  if (assessment.trustBudget.level === "depleted" || assessment.trustBudget.level === "damaging") return true
  if (assessment.relationshipImprovementLikelihood.ifProceed === "weaken") return true
  if (assessment.relationshipGoal.current === "protect_relationship" || assessment.relationshipGoal.current === "walk_away") {
    return true
  }
  return false
}

export function buildRelationshipAssessmentContextFromPacket(input: {
  priorTouchCount: number
  priorReplySummaries: string[]
  priorOutboundSubjects: string[]
  objectionSummaries: string[]
  sequenceHistorySummaries: string[]
  memoryOpenLoopSummaries: string[]
  buyingIntent?: string | null
  competitorPressure?: string | null
}): RelationshipAssessmentContextSignals {
  return {
    priorTouchCount: input.priorTouchCount,
    priorReplyCount: input.priorReplySummaries.length,
    priorOutboundSubjects: input.priorOutboundSubjects,
    objectionSummaries: input.objectionSummaries,
    priorReplySummaries: input.priorReplySummaries,
    sequenceHistorySummaries: input.sequenceHistorySummaries,
    memoryOpenLoopSummaries: input.memoryOpenLoopSummaries,
    buyingIntent: input.buyingIntent,
    competitorPressure: input.competitorPressure,
  }
}

export function loadInstitutionalAdviceSnippets(input: {
  industry?: string | null
  insights?: Array<{ summary: string; title?: string }>
}): GrowthOutreachInstitutionalAdviceSnippet[] {
  const snippets: GrowthOutreachInstitutionalAdviceSnippet[] = []
  for (const insight of input.insights ?? []) {
    const pattern = insight.summary?.trim()
    if (!pattern || pattern.length < 16) continue
    snippets.push({
      pattern,
      source: insight.title ?? "learning_engine",
    })
  }
  if (input.industry && /imaging|biomedical|medical equipment/i.test(input.industry)) {
    snippets.push({
      pattern: "Medical imaging operators often respond best to uptime and depot-field coordination discussions.",
      source: "canonical_industry_knowledge",
    })
  }
  return snippets.slice(0, 3)
}
