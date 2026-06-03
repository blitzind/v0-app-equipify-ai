import { isGuidanceEventAllowedForStage } from "@/lib/growth/live-coaching/stage-coaching-policy"
import type { ConversationStage } from "@/lib/growth/live-coaching/types"
import type { GrowthLiveGuidanceCandidate } from "@/lib/growth/live-guidance/live-guidance-types"
import type {
  GrowthLeadRealtimeIntelligenceInput,
  GrowthRealtimeLiveSnapshot,
  GrowthRealtimeTranscriptEvent,
} from "@/lib/growth/realtime/realtime-call-types"

function detectSilenceGap(events: GrowthRealtimeTranscriptEvent[]): boolean {
  if (events.length < 2) return false
  const last = events[events.length - 1]!
  const prev = events[events.length - 2]!
  const gap = last.timestampMs - prev.timestampMs
  return gap >= 15000 && prev.speaker === "rep" && prev.content.includes("?")
}

function hasSummerTimelineSignal(events: GrowthRealtimeTranscriptEvent[]): boolean {
  return events.some((event) =>
    /\b(before summer|this summer|go live|implementation timing|deadline)\b/i.test(event.content),
  )
}

function hasDemoRequestSignal(events: GrowthRealtimeTranscriptEvent[]): boolean {
  return events.some((event) =>
    /\b(demo|walkthrough|show (me )?how|see it in action|product tour|schedule a demo)\b/i.test(event.content),
  )
}

export function generateLiveGuidanceCandidates(input: {
  snapshot: GrowthRealtimeLiveSnapshot
  events: GrowthRealtimeTranscriptEvent[]
  lead: GrowthLeadRealtimeIntelligenceInput
  conversationStage?: ConversationStage | null
}): GrowthLiveGuidanceCandidate[] {
  const { snapshot, events, lead } = input
  const conversationStage = input.conversationStage ?? snapshot.conversationCoach?.stage ?? "rapport"
  const candidates: GrowthLiveGuidanceCandidate[] = []

  if (snapshot.objections.some((entry) => entry.key === "feature_gap")) {
    candidates.push({
      dedupeKey: "objection_guidance:implementation",
      eventType: "objection_guidance",
      severity: "high",
      title: "Migration / Implementation Concern",
      operatorPrompt: "Validate scope and migration path before defending the product.",
      recommendation: "What part of the rollout feels hardest today — data, training, or workflow change?",
      supportingReason: "Implementation or feature gap concern detected.",
      confidenceScore: 85,
    })
  }

  if (snapshot.buyingSignals.some((signal) => signal.key === "decision_maker_confirmed")) {
    candidates.push({
      dedupeKey: "buying_signal_detected:dm_confirmed",
      eventType: "buying_signal_detected",
      severity: "medium",
      title: "Buying Committee Identified",
      operatorPrompt: "Confirm authority and success criteria before advancing.",
      recommendation: "Besides yourself, who else would weigh in before a decision?",
      supportingReason: "Decision-maker authority signal detected in conversation.",
      confidenceScore: 82,
    })
  }

  if (hasDemoRequestSignal(events)) {
    candidates.push({
      dedupeKey: "meeting_lock_prompt:demo",
      eventType: "meeting_lock_prompt",
      severity: "high",
      title: "Demo Opportunity",
      operatorPrompt: "Convert demo interest into a concrete next step.",
      recommendation: "Would a 30-minute working session next week help you evaluate fit?",
      supportingReason: "Prospect requested or accepted a demo-style next step.",
      confidenceScore: 92,
    })
  }

  if (snapshot.objections.some((entry) => entry.key === "pricing_objection")) {
    candidates.push({
      dedupeKey: "pricing_pressure",
      eventType: "pricing_pressure",
      severity: "high",
      title: "Pricing Pressure",
      operatorPrompt: "Do not defend pricing immediately.",
      recommendation:
        "Can I ask, compared to what you're doing today, what feels expensive?",
      supportingReason: "Prospect raised pricing objection.",
      confidenceScore: 88,
    })
  }

  if (snapshot.objections.some((entry) => entry.key === "budget_concern")) {
    candidates.push({
      dedupeKey: "objection_guidance:budget",
      eventType: "objection_guidance",
      severity: "high",
      title: "Budget Objection",
      operatorPrompt: "Separate budget from priority before negotiating.",
      recommendation: "Is budget the issue, or priority?",
      supportingReason: "Budget concern detected in conversation.",
      confidenceScore: 84,
    })
  }

  if (snapshot.talkRatio.repTalkPercent > 65) {
    candidates.push({
      dedupeKey: "talking_too_much",
      eventType: "talking_too_much",
      severity: "medium",
      title: "You're Speaking Too Much",
      operatorPrompt: "Pause and let the prospect respond.",
      recommendation: "Walk me through how you're handling this today.",
      supportingReason: `Rep talk ratio is ${snapshot.talkRatio.repTalkPercent}% (goal 45–60%).`,
      confidenceScore: 82,
    })
  }

  if (snapshot.talkRatio.flags.includes("not_enough_questions")) {
    candidates.push({
      dedupeKey: "ask_followup_question",
      eventType: "ask_followup_question",
      severity: "medium",
      title: "Ask a Follow-Up Question",
      operatorPrompt: "Discovery is stalling — ask an open question.",
      recommendation: "What would success look like if this worked perfectly?",
      supportingReason: "No rep questions detected in recent transcript.",
      confidenceScore: 75,
    })
  }

  if (snapshot.discovery.missing.includes("decision_maker_confirmed")) {
    candidates.push({
      dedupeKey: "discovery_gap_guidance:dm",
      eventType: "discovery_gap_guidance",
      severity: "high",
      title: "Decision Maker Not Confirmed",
      operatorPrompt: "Map buying committee before advancing.",
      recommendation: "Who besides yourself would be involved in this decision?",
      supportingReason: "Decision maker discovery incomplete.",
      confidenceScore: 86,
    })
  }

  if (snapshot.discovery.missing.includes("timeline_asked")) {
    candidates.push({
      dedupeKey: "discovery_gap_guidance:timeline",
      eventType: "discovery_gap_guidance",
      severity: "medium",
      title: "Timeline Not Covered",
      operatorPrompt: "Lock implementation timing.",
      recommendation: "What would implementation timing ideally look like?",
      supportingReason: "Timeline discovery gap detected.",
      confidenceScore: 78,
    })
  }

  if (
    snapshot.buyingSignals.some((signal) =>
      ["timeline_urgency", "commitment_language", "implementation_signal"].includes(signal.key),
    ) ||
    hasSummerTimelineSignal(events)
  ) {
    candidates.push({
      dedupeKey: "buying_signal_detected",
      eventType: "buying_signal_detected",
      severity: "high",
      title: "HIGH INTENT",
      operatorPrompt: "Lock timeline while intent is strong.",
      recommendation: "What would implementation timing ideally look like?",
      supportingReason: "Strong buying or timeline signal detected.",
      confidenceScore: 90,
    })
    candidates.push({
      dedupeKey: "meeting_lock_prompt",
      eventType: "meeting_lock_prompt",
      severity: "high",
      title: "Lock Next Step",
      operatorPrompt: "Convert intent into a concrete next step.",
      recommendation: "Would it make sense to schedule a working session next week?",
      supportingReason: "Buying momentum supports meeting lock.",
      confidenceScore: 85,
    })
  }

  if (snapshot.competitorGuidance.length > 0 || (lead.conversationCompetitorPressure ?? 0) >= 30) {
    const competitor = snapshot.competitorGuidance[0]?.competitor ?? "Current vendor"
    candidates.push({
      dedupeKey: "competitor_response",
      eventType: "competitor_response",
      severity: "high",
      title: "COMPETITOR PRESSURE",
      operatorPrompt: "Explore gaps — do not trash-talk.",
      recommendation:
        snapshot.competitorGuidance[0]?.suggestedAngle ??
        "What would you improve about your current setup?",
      supportingReason: `${competitor} mentioned or competitor pressure elevated.`,
      confidenceScore: 87,
    })
  }

  if (detectSilenceGap(events)) {
    candidates.push({
      dedupeKey: "silence_recovery",
      eventType: "silence_recovery",
      severity: "medium",
      title: "Silence Detected",
      operatorPrompt: "Re-engage without pressure.",
      recommendation: "What questions do you have so far?",
      supportingReason: "Extended silence after rep question.",
      confidenceScore: 72,
    })
  }

  if (
    snapshot.riskFlags.includes("multiple_objections_stacking") ||
    snapshot.riskFlags.includes("negative_sentiment_shift") ||
    lead.conversationBuyingIntent === "weak"
  ) {
    candidates.push({
      dedupeKey: "momentum_drop",
      eventType: "momentum_drop",
      severity: "high",
      title: "Rebuild Momentum",
      operatorPrompt: "Summarize and confirm understanding.",
      recommendation: "Can I make sure I'm understanding correctly?",
      supportingReason: "Objections stacking or sentiment cooling.",
      confidenceScore: 83,
    })
  }

  if (lead.executivePriorityTier === "executive_now" || snapshot.riskFlags.includes("executive_account_risk")) {
    candidates.push({
      dedupeKey: "executive_risk",
      eventType: "executive_risk",
      severity: "high",
      title: "Executive Account Risk",
      operatorPrompt: "Keep discovery tight and confirm next step.",
      recommendation: "What would need to be true for leadership to prioritize this?",
      supportingReason: "Executive-tier account with elevated call risk.",
      confidenceScore: 91,
    })
  }

  if (lead.relationshipTrend === "cooling" || lead.memoryEngagementTrend === "cooling" || lead.memoryEngagementTrend === "declining") {
    candidates.push({
      dedupeKey: "relationship_recovery",
      eventType: "relationship_recovery",
      severity: "medium",
      title: "Relationship Recovery",
      operatorPrompt: "Rebuild trust before pushing close.",
      recommendation: "What's changed on your side since we last spoke?",
      supportingReason:
        lead.memoryEngagementTrend === "declining" || lead.memoryEngagementTrend === "cooling"
          ? "Relationship memory trend is cooling."
          : "Relationship trend is cooling.",
      confidenceScore: 80,
    })
  }

  if ((lead.memoryTopObjections?.length ?? 0) > 0) {
    candidates.push({
      dedupeKey: "memory_objection_context",
      eventType: "objection_detected",
      severity: "medium",
      title: "Known Objection Context",
      operatorPrompt: `Address remembered concern: ${lead.memoryTopObjections![0]!.slice(0, 120)}`,
      recommendation: "Can we revisit the concern you raised earlier?",
      supportingReason: "Relationship memory includes unresolved objection context.",
      confidenceScore: 78,
    })
  }

  if ((lead.memoryAvoidRepeating?.length ?? 0) > 0) {
    candidates.push({
      dedupeKey: "memory_avoid_repeat",
      eventType: "objection_guidance",
      severity: "medium",
      title: "Do Not Re-Ask",
      operatorPrompt: `Avoid repeating: ${lead.memoryAvoidRepeating![0]!.slice(0, 120)}`,
      recommendation: "Acknowledge what they already shared before asking anything new.",
      supportingReason: "Relationship memory flagged topics already answered.",
      confidenceScore: 76,
    })
  }

  if (
    (lead.memoryRelationshipStage === "evaluating" || lead.memoryRelationshipStage === "opportunity") &&
    (lead.memoryCoverageScore ?? 0) >= 40
  ) {
    candidates.push({
      dedupeKey: "memory_active_evaluation",
      eventType: "buying_signal_detected",
      severity: "medium",
      title: "Memory-Backed Evaluation",
      operatorPrompt: "Confirm where they are in the evaluation process.",
      recommendation: "What would help you decide whether to move forward?",
      supportingReason: `Relationship memory stage: ${lead.memoryRelationshipStage}.`,
      confidenceScore: 77,
    })
  }

  if (lead.conversationUrgencyLevel === "high" || lead.conversationUrgencyLevel === "critical") {
    candidates.push({
      dedupeKey: "urgency_detected",
      eventType: "urgency_detected",
      severity: "high",
      title: "Urgency Detected",
      operatorPrompt: "Match urgency with a clear next step.",
      recommendation: "If we moved quickly, what would need to happen on your end?",
      supportingReason: "Conversation urgency is elevated.",
      confidenceScore: 84,
    })
  }

  if (
    snapshot.buyingSignals.length >= 2 &&
    !snapshot.riskFlags.includes("no_next_step_identified") &&
    snapshot.discovery.covered.length >= 3
  ) {
    candidates.push({
      dedupeKey: "close_attempt_recommended",
      eventType: "close_attempt_recommended",
      severity: "medium",
      title: "Close Attempt Window",
      operatorPrompt: "Summarize value and propose next step.",
      recommendation: "Based on what you've shared, should we outline a pilot timeline?",
      supportingReason: "Discovery strong with multiple buying signals.",
      confidenceScore: 79,
    })
  }

  if (snapshot.objections.some((entry) => entry.key === "timing_objection")) {
    candidates.push({
      dedupeKey: "objection_guidance:timing",
      eventType: "objection_guidance",
      severity: "medium",
      title: "Timing Objection",
      operatorPrompt: "Explore what would need to change for timing to work.",
      recommendation: "If timing weren't a factor, would this be a priority?",
      supportingReason: "Timing objection detected.",
      confidenceScore: 76,
    })
  }

  const byKey = new Map<string, GrowthLiveGuidanceCandidate>()
  for (const candidate of candidates) {
    if (!isGuidanceEventAllowedForStage(conversationStage, candidate.eventType, candidate.dedupeKey)) {
      continue
    }
    if (!byKey.has(candidate.dedupeKey)) byKey.set(candidate.dedupeKey, candidate)
  }
  return [...byKey.values()].sort((a, b) => b.confidenceScore - a.confidenceScore)
}

export function pickSuggestedNextQuestion(input: {
  snapshot: GrowthRealtimeLiveSnapshot
  candidates: GrowthLiveGuidanceCandidate[]
}): string | null {
  if (input.snapshot.conversationCoach?.primaryPhrase) {
    return input.snapshot.conversationCoach.primaryPhrase
  }
  if (input.candidates[0]?.recommendation) return input.candidates[0].recommendation
  return input.snapshot.recommendedNextQuestion
}
