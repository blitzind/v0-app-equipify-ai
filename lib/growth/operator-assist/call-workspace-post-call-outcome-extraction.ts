/** GE-AIOS-CALL-WORKSPACE-INTELLIGENCE-2B — Outcome extraction (conclusions only, no transcript memory). */

import type { CallIntelligenceScorecardPublicView } from "@/lib/growth/call-intelligence/call-intelligence-types"
import type { AdaptiveProspectEvent } from "@/lib/growth/aios/growth/growth-adaptive-loop-1a-types"
import { buildAdaptiveProspectEvent } from "@/lib/growth/aios/growth/growth-adaptive-loop-1a"
import type { CallWorkspaceAiosLiveReasoningSnapshot } from "@/lib/growth/operator-assist/call-workspace-aios-live-reasoning-types"
import { deriveLiveAdaptiveEventsFromSnapshot } from "@/lib/growth/operator-assist/call-workspace-aios-live-signals"
import type { NativeCallWrapupInput } from "@/lib/growth/native-dialer/native-dialer-wrapup-engine"
import type { GrowthRealtimeLiveSnapshot } from "@/lib/growth/realtime/realtime-call-types"
import type {
  CallOutcomeSummary,
  CallWorkspaceMemoryReviewItem,
  CallWorkspaceCommitteeSuggestion,
} from "@/lib/growth/operator-assist/call-workspace-post-call-closure-types"

export type ExtractedCallOutcomes = {
  callOutcome: CallOutcomeSummary
  meetingSummary: string
  businessConclusions: string[]
  personalConclusions: string[]
  objections: string[]
  commitments: string[]
  buyingSignals: string[]
  committeeSignals: string[]
  adaptiveEvents: AdaptiveProspectEvent[]
  committeeSuggestions: CallWorkspaceCommitteeSuggestion[]
  memoryCandidates: Array<{
    conclusion: string
    humanMemoryKind: "business_fact" | "sales_conclusion" | "action_commitment" | "personal_context"
    confidence: "low" | "medium" | "high"
    reviewRequired: boolean
  }>
  memoryReviewItems: CallWorkspaceMemoryReviewItem[]
}

function uniqueLines(lines: Array<string | null | undefined>, limit = 12): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of lines) {
    const trimmed = line?.trim()
    if (!trimmed || seen.has(trimmed.toLowerCase())) continue
    seen.add(trimmed.toLowerCase())
    out.push(trimmed)
    if (out.length >= limit) break
  }
  return out
}

function mapWrapupOutcome(outcome: string | undefined): CallOutcomeSummary["outcome"] {
  if (outcome === "meeting_booked") return "meeting_booked"
  if (outcome === "no_answer") return "no_answer"
  if (outcome === "voicemail") return "voicemail"
  return "connected"
}

export function buildCallWorkspacePostCallAdaptiveEvents(input: {
  generatedAt: string
  liveReasoning: CallWorkspaceAiosLiveReasoningSnapshot | null
  liveSnapshot: GrowthRealtimeLiveSnapshot | null
  scorecard: CallIntelligenceScorecardPublicView | null
  operatorWrapup?: NativeCallWrapupInput | null
}): AdaptiveProspectEvent[] {
  const occurredAt = input.generatedAt
  const events: AdaptiveProspectEvent[] = []
  const seen = new Set<string>()

  function pushOnce(event: AdaptiveProspectEvent): void {
    const key = `${event.type}:${event.summary}`
    if (seen.has(key)) return
    if ([...seen].some((existing) => existing.startsWith(`${event.type}:`))) {
      const typeOnlyDupes = new Set([
        "competitor_mentioned",
        "already_have_software",
        "timing_objection",
        "meeting_booked",
        "meeting_completed",
        "champion_identified",
      ])
      if (typeOnlyDupes.has(event.type)) return
    }
    seen.add(key)
    events.push(event)
  }

  for (const event of deriveLiveAdaptiveEventsFromSnapshot(input.liveSnapshot)) {
    pushOnce(event)
  }

  if (input.liveReasoning?.operationalProblem) {
    pushOnce(
      buildAdaptiveProspectEvent({
        type: "company_research_updated",
        occurredAt,
        summary: `Operational pain confirmed: ${input.liveReasoning.operationalProblem}`,
      }),
    )
  }

  for (const signal of input.liveReasoning?.buyingSignals ?? []) {
    pushOnce(
      buildAdaptiveProspectEvent({
        type: "pricing_discussion",
        occurredAt,
        summary: signal,
      }),
    )
  }

  for (const risk of input.liveReasoning?.conversationRisks ?? []) {
    if (/competitor|already have|incumbent/i.test(risk)) {
      pushOnce(
        buildAdaptiveProspectEvent({
          type: "competitor_mentioned",
          occurredAt,
          summary: risk,
        }),
      )
    }
    if (/timing|next quarter|later|not now/i.test(risk)) {
      pushOnce(
        buildAdaptiveProspectEvent({
          type: "timing_objection",
          occurredAt,
          summary: risk,
        }),
      )
    }
    if (/objection|budget|price/i.test(risk)) {
      pushOnce(
        buildAdaptiveProspectEvent({
          type: "objection",
          occurredAt,
          summary: risk,
        }),
      )
    }
  }

  for (const objection of input.scorecard?.detectedObjections ?? []) {
    pushOnce(
      buildAdaptiveProspectEvent({
        type: "objection",
        occurredAt,
        summary: objection.label,
        detail: objection.key,
      }),
    )
  }

  for (const signal of input.scorecard?.buyingSignals ?? []) {
    if (/champion|decision/i.test(signal.label)) {
      pushOnce(
        buildAdaptiveProspectEvent({
          type: "champion_identified",
          occurredAt,
          summary: signal.label,
        }),
      )
    }
    if (/committee|stakeholder|director/i.test(signal.label)) {
      pushOnce(
        buildAdaptiveProspectEvent({
          type: "buying_committee_expansion",
          occurredAt,
          summary: signal.label,
        }),
      )
    }
  }

  if (input.scorecard?.competitorMentions?.length) {
    for (const mention of input.scorecard.competitorMentions) {
      pushOnce(
        buildAdaptiveProspectEvent({
          type: "competitor_mentioned",
          occurredAt,
          summary: mention.label,
        }),
      )
    }
    pushOnce(
      buildAdaptiveProspectEvent({
        type: "already_have_software",
        occurredAt,
        summary: input.scorecard.competitorMentions[0]?.label ?? "Competing system in use",
      }),
    )
  }

  if (input.operatorWrapup?.competitorMentioned) {
    pushOnce(
      buildAdaptiveProspectEvent({
        type: "competitor_mentioned",
        occurredAt,
        summary: "Operator confirmed competitor mentioned on call",
      }),
    )
  }

  if (input.operatorWrapup?.timelineDetected) {
    pushOnce(
      buildAdaptiveProspectEvent({
        type: "timing_objection",
        occurredAt,
        summary: "Timing discussed — next quarter or later window",
      }),
    )
  }

  if (input.operatorWrapup?.championIdentified) {
    pushOnce(
      buildAdaptiveProspectEvent({
        type: "champion_identified",
        occurredAt,
        summary: "Operator confirmed champion signal on call",
      }),
    )
  }

  if (input.operatorWrapup?.meetingBooked || input.operatorWrapup?.outcome === "meeting_booked") {
    pushOnce(
      buildAdaptiveProspectEvent({
        type: "meeting_booked",
        occurredAt,
        summary: "Follow-up meeting agreed on call",
      }),
    )
  }

  if (
    input.operatorWrapup?.connected ||
    input.operatorWrapup?.outcome === "connected" ||
    input.scorecard?.outcome === "positive"
  ) {
    pushOnce(
      buildAdaptiveProspectEvent({
        type: "meeting_completed",
        occurredAt,
        summary: "Connected call completed with selling conclusions captured",
      }),
    )
  }

  if (input.operatorWrapup?.outcome === "not_interested") {
    pushOnce(
      buildAdaptiveProspectEvent({
        type: "relationship_deterioration",
        occurredAt,
        summary: "No next step — opportunity stalled on call",
      }),
    )
  }

  return events
}

export function extractCallWorkspacePostCallOutcomes(input: {
  generatedAt: string
  companyName: string | null
  liveReasoning: CallWorkspaceAiosLiveReasoningSnapshot | null
  liveSnapshot: GrowthRealtimeLiveSnapshot | null
  scorecard: CallIntelligenceScorecardPublicView | null
  operatorWrapup?: NativeCallWrapupInput | null
  operatorDisposition?: string | null
  operatorNotes?: string | null
  nextActionLabel?: string | null
}): ExtractedCallOutcomes {
  const company = input.companyName ?? "this account"
  const adaptiveEvents = buildCallWorkspacePostCallAdaptiveEvents(input)

  const businessConclusions = uniqueLines([
    input.liveReasoning?.operationalProblem
      ? `${company} confirmed operational pressure: ${input.liveReasoning.operationalProblem}`
      : null,
    input.scorecard?.competitorMentions?.[0]
      ? `${company} currently uses ${input.scorecard.competitorMentions[0].label}`
      : input.operatorWrapup?.competitorMentioned
        ? `${company} confirmed a competing system is in use`
        : null,
    input.operatorWrapup?.timelineDetected ? "Timing window is next quarter or later" : null,
    input.liveReasoning?.discoveryProgress
      ? `Discovery progress: ${input.liveReasoning.discoveryProgress}`
      : null,
    ...(input.scorecard?.discoveryGaps?.map((gap) => `Open discovery area: ${gap.label}`) ?? []),
  ])

  const objections = uniqueLines([
    ...(input.liveReasoning?.conversationRisks?.filter((r) => /objection|budget|price|timing|competitor/i.test(r)) ??
      []),
    ...(input.scorecard?.detectedObjections?.map((o) => o.label) ?? []),
    input.operatorWrapup?.objectionCategory ?? null,
  ])

  const buyingSignals = uniqueLines([
    ...(input.liveReasoning?.buyingSignals ?? []),
    ...(input.liveReasoning?.opportunitySignals ?? []),
    ...(input.scorecard?.buyingSignals?.map((s) => s.label) ?? []),
    ...(input.operatorWrapup?.buyingSignals ?? []),
  ])

  const committeeSignals = uniqueLines([
    input.liveReasoning?.committeeStatus,
    ...buyingSignals.filter((s) => /director|stakeholder|committee|decision maker|economic buyer/i.test(s)),
    input.operatorWrapup?.decisionMakerPresent ? "Decision maker present on call" : null,
    input.operatorWrapup?.championIdentified ? "Champion signal confirmed by operator" : null,
  ])

  const commitments = uniqueLines([
    ...(input.scorecard?.nextStepCommitments?.map((c) => c.label) ?? []),
    input.liveReasoning?.sayThisNext.expectedOutcome,
    /checklist|workflow|send|promise|follow up|follow-up|recap/i.test(input.operatorNotes ?? "")
      ? input.operatorNotes
      : null,
    input.operatorWrapup?.meetingBooked ? "Agreed to schedule a follow-up meeting" : null,
    input.operatorWrapup?.notes?.match(/send|promise|checklist|workflow/i) ? input.operatorWrapup.notes : null,
  ])

  const personalConclusions: string[] = []

  const meetingSummary = [
    `Call with ${company} completed.`,
    businessConclusions[0],
    commitments[0] ? `Commitment: ${commitments[0]}` : null,
    input.nextActionLabel ? `Next: ${input.nextActionLabel}` : null,
  ]
    .filter(Boolean)
    .join(" ")

  const callOutcome: CallOutcomeSummary = {
    outcome: input.scorecard?.outcome ?? mapWrapupOutcome(input.operatorWrapup?.outcome) ?? "unknown",
    disposition: input.operatorDisposition ?? input.operatorWrapup?.outcome ?? null,
    overallScore: input.scorecard?.overallScore ?? null,
    riskLevel: input.scorecard?.riskLevel ?? null,
    confidence: input.liveReasoning?.confidenceLevel ?? "medium",
    operatorNotes: input.operatorNotes ?? input.operatorWrapup?.notes ?? null,
  }

  const memoryCandidates: ExtractedCallOutcomes["memoryCandidates"] = []
  for (const conclusion of businessConclusions) {
    memoryCandidates.push({
      conclusion,
      humanMemoryKind: "business_fact",
      confidence: "high",
      reviewRequired: false,
    })
  }
  for (const objection of objections) {
    memoryCandidates.push({
      conclusion: objection,
      humanMemoryKind: "sales_conclusion",
      confidence: "medium",
      reviewRequired: false,
    })
  }
  for (const commitment of commitments) {
    memoryCandidates.push({
      conclusion: commitment,
      humanMemoryKind: "action_commitment",
      confidence: commitment.length < 12 ? "low" : "high",
      reviewRequired: commitment.length < 12,
    })
  }
  if (input.operatorWrapup?.competitorMentioned) {
    memoryCandidates.push({
      conclusion: `${company} uses a competing field service system`,
      humanMemoryKind: "business_fact",
      confidence: "high",
      reviewRequired: false,
    })
  }
  if (input.operatorWrapup?.timelineDetected) {
    memoryCandidates.push({
      conclusion: "Buying timing is next quarter",
      humanMemoryKind: "sales_conclusion",
      confidence: "high",
      reviewRequired: false,
    })
  }

  const committeeSuggestions: CallWorkspaceCommitteeSuggestion[] = []
  for (const signal of committeeSignals) {
    const isServiceDirector = /service director/i.test(signal)
    const isStakeholder = /stakeholder|director|decision maker|economic buyer|technical approver/i.test(signal)
    if (!isStakeholder && !isServiceDirector) continue
    committeeSuggestions.push({
      role: isServiceDirector ? "technical_approver" : "missing_stakeholder",
      personLabel: isServiceDirector ? "Service Director" : null,
      signal,
      confidence: isServiceDirector ? "high" : "medium",
      reviewRequired: !isServiceDirector,
      canonicalPathQueued: isServiceDirector,
    })
  }

  const memoryReviewItems: CallWorkspaceMemoryReviewItem[] = memoryCandidates
    .filter((row) => row.reviewRequired)
    .map((row) => ({
      conclusion: row.conclusion,
      humanMemoryKind: row.humanMemoryKind,
      confidence: row.confidence,
      reason: "Insufficient confidence to treat as durable fact without operator review",
    }))

  return {
    callOutcome,
    meetingSummary,
    businessConclusions,
    personalConclusions,
    objections,
    commitments,
    buyingSignals,
    committeeSignals,
    adaptiveEvents,
    committeeSuggestions,
    memoryCandidates,
    memoryReviewItems,
  }
}
