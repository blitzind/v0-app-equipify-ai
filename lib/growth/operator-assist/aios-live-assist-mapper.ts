/** Map AI OS live reasoning into operator assist events and say-this-next (client-safe). */

import type { GrowthLiveGuidanceSeverity } from "@/lib/growth/live-guidance/live-guidance-types"
import { buildAssistDedupeKey } from "@/lib/growth/operator-assist/deduplication"
import {
  GROWTH_CALL_WORKSPACE_AIOS_LIVE_REASONING_QA_MARKER,
  type CallWorkspaceAiosLiveReasoningSnapshot,
} from "@/lib/growth/operator-assist/call-workspace-aios-live-reasoning-types"
import {
  GROWTH_SAY_THIS_NEXT_QA_MARKER,
  type SayThisNextSnapshot,
} from "@/lib/growth/operator-assist/resolve-say-this-next"
import {
  type UnifiedOperatorAssistCategory,
  type UnifiedOperatorAssistEvent,
} from "@/lib/growth/operator-assist/types"
import { scoreUnifiedAssistEvent } from "@/lib/growth/operator-assist/unified-priority"

function mapAiosEvent(input: {
  id: string
  category: UnifiedOperatorAssistCategory
  eventType: string
  severity: GrowthLiveGuidanceSeverity
  title: string
  operatorPrompt: string
  recommendation: string
  evidenceText: string
  confidenceScore: number
  surfacedAt: string
  dedupeKey: string
}): UnifiedOperatorAssistEvent {
  const base = {
    id: input.id,
    source: "aios_reasoning" as const,
    sourceKind: "aios_reasoning" as const,
    lifecycleStatus: "active" as const,
    category: input.category,
    eventType: input.eventType,
    severity: input.severity,
    title: input.title,
    operatorPrompt: input.operatorPrompt,
    recommendation: input.recommendation,
    evidenceText: input.evidenceText,
    confidenceScore: input.confidenceScore,
    surfacedAt: input.surfacedAt,
    expiresAt: null,
    transcriptSegmentId: null,
    sequenceNumber: null,
    voiceCallId: null,
    growthGuidanceEventId: null,
    coachingLeadId: null,
    realtimeSessionId: null,
    dedupeKey: input.dedupeKey,
  }
  return { ...base, ...scoreUnifiedAssistEvent(base) }
}

export function mapAiosLiveReasoningToAssistEvents(
  snapshot: CallWorkspaceAiosLiveReasoningSnapshot | null,
): UnifiedOperatorAssistEvent[] {
  if (!snapshot) return []

  const events: UnifiedOperatorAssistEvent[] = []
  const surfacedAt = snapshot.generatedAt

  events.push(
    mapAiosEvent({
      id: `aios:say-this-next:${snapshot.triggeredBySequenceNumber ?? "bootstrap"}`,
      category: "coaching",
      eventType: "aios_say_this_next",
      severity: "high",
      title: "Exactly what to say next",
      operatorPrompt: snapshot.sayThisNext.recommendedNextSentence,
      recommendation: snapshot.sayThisNext.recommendedNextSentence,
      evidenceText: snapshot.sayThisNext.why,
      confidenceScore: snapshot.sayThisNext.confidence,
      surfacedAt,
      dedupeKey: buildAssistDedupeKey({
        category: "coaching",
        eventType: "aios_say_this_next",
        evidenceText: snapshot.sayThisNext.recommendedNextSentence,
      }),
    }),
  )

  if (snapshot.operationalProblem) {
    events.push(
      mapAiosEvent({
        id: `aios:business-pressure:${snapshot.triggeredBySequenceNumber ?? "bootstrap"}`,
        category: "guidance",
        eventType: "aios_business_pressure",
        severity: "medium",
        title: "Business pressure",
        operatorPrompt: `Explore whether ${snapshot.operationalProblem.toLowerCase()} is the live friction point.`,
        recommendation: snapshot.operationalProblem,
        evidenceText: snapshot.sayThisNext.businessPressure ?? snapshot.operationalProblem,
        confidenceScore: snapshot.sayThisNext.confidence,
        surfacedAt,
        dedupeKey: buildAssistDedupeKey({
          category: "guidance",
          eventType: "aios_business_pressure",
          evidenceText: snapshot.operationalProblem,
        }),
      }),
    )
  }

  for (const [index, risk] of snapshot.conversationRisks.entries()) {
    events.push(
      mapAiosEvent({
        id: `aios:risk:${index}`,
        category: "risk",
        eventType: "aios_conversation_risk",
        severity: "medium",
        title: "Conversation risk",
        operatorPrompt: "Address this carefully before pushing forward.",
        recommendation: risk,
        evidenceText: risk,
        confidenceScore: 0.7,
        surfacedAt,
        dedupeKey: buildAssistDedupeKey({
          category: "risk",
          eventType: "aios_conversation_risk",
          evidenceText: risk,
        }),
      }),
    )
  }

  for (const [index, signal] of snapshot.buyingSignals.entries()) {
    events.push(
      mapAiosEvent({
        id: `aios:buying:${index}`,
        category: "buying_signal",
        eventType: "aios_buying_signal",
        severity: "medium",
        title: "Buying signal",
        operatorPrompt: "Acknowledge the signal and propose the smallest next commitment.",
        recommendation: signal,
        evidenceText: signal,
        confidenceScore: 0.75,
        surfacedAt,
        dedupeKey: buildAssistDedupeKey({
          category: "buying_signal",
          eventType: "aios_buying_signal",
          evidenceText: signal,
        }),
      }),
    )
  }

  for (const [index, objection] of (snapshot.consultantDiscoveryIntelligence?.rankedDiscoveryQuestions ?? []).slice(0, 2).entries()) {
    events.push(
      mapAiosEvent({
        id: `aios:discovery:${index}`,
        category: "guidance",
        eventType: "aios_discovery_question",
        severity: "low",
        title: "Discovery angle",
        operatorPrompt: objection.question,
        recommendation: objection.question,
        evidenceText: objection.revealsThinking,
        confidenceScore: 0.68,
        surfacedAt,
        dedupeKey: buildAssistDedupeKey({
          category: "guidance",
          eventType: "aios_discovery_question",
          evidenceText: objection.question,
        }),
      }),
    )
  }

  if (snapshot.committeeStatus) {
    events.push(
      mapAiosEvent({
        id: `aios:committee:${snapshot.triggeredBySequenceNumber ?? "bootstrap"}`,
        category: "guidance",
        eventType: "aios_committee_status",
        severity: "medium",
        title: "Committee status",
        operatorPrompt: "Confirm who else should be involved before advancing.",
        recommendation: snapshot.committeeStatus,
        evidenceText: snapshot.committeeStatus,
        confidenceScore: 0.66,
        surfacedAt,
        dedupeKey: buildAssistDedupeKey({
          category: "guidance",
          eventType: "aios_committee_status",
          evidenceText: snapshot.committeeStatus,
        }),
      }),
    )
  }

  for (const [index, advisory] of snapshot.institutionalAdvisory.entries()) {
    events.push(
      mapAiosEvent({
        id: `aios:institutional:${index}`,
        category: "guidance",
        eventType: "aios_institutional_advisory",
        severity: "low",
        title: "Institutional learning",
        operatorPrompt: advisory,
        recommendation: advisory,
        evidenceText: advisory,
        confidenceScore: 0.6,
        surfacedAt,
        dedupeKey: buildAssistDedupeKey({
          category: "guidance",
          eventType: "aios_institutional_advisory",
          evidenceText: advisory,
        }),
      }),
    )
  }

  return events
}

export function buildAiosSayThisNextSnapshot(
  snapshot: CallWorkspaceAiosLiveReasoningSnapshot | null,
): SayThisNextSnapshot | null {
  if (!snapshot?.sayThisNext.recommendedNextSentence) return null

  return {
    phrase: snapshot.sayThisNext.recommendedNextSentence,
    contextLabel: snapshot.conversationStage ?? "Live conversation",
    rationale: snapshot.sayThisNext.why,
    stageLabel: snapshot.conversationStage,
    stageObjective: snapshot.sayThisNext.currentObjective,
    source: "aios_live_reasoning",
    confidenceScore: snapshot.sayThisNext.confidence,
    updatedAt: snapshot.generatedAt,
    eventId: `aios:${snapshot.triggeredBySequenceNumber ?? "bootstrap"}`,
    qaMarker: GROWTH_SAY_THIS_NEXT_QA_MARKER,
    aiosQaMarker: GROWTH_CALL_WORKSPACE_AIOS_LIVE_REASONING_QA_MARKER,
    businessPressure: snapshot.sayThisNext.businessPressure,
    expectedOutcome: snapshot.sayThisNext.expectedOutcome,
    alternativeResponse: snapshot.sayThisNext.alternativeResponse,
    recoveryResponse: snapshot.sayThisNext.recoveryResponse,
    scenarioBranches: snapshot.sayThisNext.scenarioBranches,
  }
}
