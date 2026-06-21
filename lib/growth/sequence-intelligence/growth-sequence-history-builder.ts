/** GS-AI-PLAYBOOK-4C — Sequence history builder (client-safe). */

import type { OutreachContextPacket } from "@/lib/growth/outreach/personalization/personalization-types"
import type {
  GrowthSequenceHistoryTouch,
  GrowthSequenceSignalInput,
} from "@/lib/growth/sequence-intelligence/growth-sequence-state-types"

export function buildSequenceSignalsFromContextPacket(
  packet: OutreachContextPacket,
  extras?: Partial<GrowthSequenceSignalInput>,
): GrowthSequenceSignalInput {
  return {
    priorTouchCount: packet.priorTouchCount ?? extras?.priorTouchCount ?? 0,
    priorTouchSummaries: packet.priorTouchSummaries ?? extras?.priorTouchSummaries ?? [],
    priorOutboundSubjects: packet.priorOutboundSubjects ?? extras?.priorOutboundSubjects ?? [],
    priorReplySummaries: packet.priorReplySummaries ?? extras?.priorReplySummaries ?? [],
    sequenceHistorySummaries: packet.sequenceHistorySummaries ?? extras?.sequenceHistorySummaries ?? [],
    timelineEventSummaries: packet.timelineEventSummaries ?? extras?.timelineEventSummaries ?? [],
    memoryInteractionSummaries: packet.memoryInteractionSummaries ?? extras?.memoryInteractionSummaries ?? [],
    memoryAvoidRepeating: packet.memoryAvoidRepeating ?? extras?.memoryAvoidRepeating ?? [],
    memoryEngagementTrend: packet.memoryEngagementTrend ?? extras?.memoryEngagementTrend ?? null,
    engagementScore: packet.engagementScore ?? extras?.engagementScore ?? null,
    emailOpens: extras?.emailOpens ?? 0,
    emailClicks: extras?.emailClicks ?? 0,
    meetings: (packet.memoryCommitmentSummaries?.length ?? 0) + (extras?.meetings ?? 0),
    assetViews: extras?.assetViews ?? extras?.videoViews ?? extras?.sharePageViews ?? 0,
    videoViews: extras?.videoViews ?? 0,
    sharePageViews: extras?.sharePageViews ?? 0,
    daysSinceLastTouch: extras?.daysSinceLastTouch ?? null,
    daysInSequence: extras?.daysInSequence ?? null,
    hasActiveSequence: extras?.hasActiveSequence ?? packet.sequenceHistorySummaries.length > 0,
    sequenceStepIndex: extras?.sequenceStepIndex ?? null,
    buyingStage: packet.industryContext?.buyerJourneyContext?.buyingStage.stage ?? extras?.buyingStage ?? null,
    conversationState:
      packet.industryContext?.buyerJourneyContext?.conversationState.state ?? extras?.conversationState ?? null,
    regenerationCategory: packet.industryContext?.regenerationFeedback?.category ?? extras?.regenerationCategory ?? null,
  }
}

export function buildGrowthSequenceHistory(input: GrowthSequenceSignalInput): GrowthSequenceHistoryTouch[] {
  const touches: GrowthSequenceHistoryTouch[] = []
  let index = 0

  for (const summary of input.priorTouchSummaries ?? []) {
    touches.push({
      index: ++index,
      channel: "email",
      subject: null,
      summary,
      observedAt: null,
      source: "outbound_message",
    })
  }

  for (const summary of input.sequenceHistorySummaries ?? []) {
    touches.push({
      index: ++index,
      channel: "sequence",
      subject: null,
      summary,
      observedAt: null,
      source: "sequence_step",
    })
  }

  for (const subject of input.priorOutboundSubjects ?? []) {
    if (touches.some((entry) => entry.summary.toLowerCase() === subject.toLowerCase())) continue
    touches.push({
      index: ++index,
      channel: "email",
      subject,
      summary: subject,
      observedAt: null,
      source: "queue_item",
    })
  }

  for (const summary of input.timelineEventSummaries ?? []) {
    touches.push({
      index: ++index,
      channel: null,
      subject: null,
      summary,
      observedAt: null,
      source: "timeline",
    })
  }

  for (const summary of input.memoryInteractionSummaries ?? []) {
    touches.push({
      index: ++index,
      channel: null,
      subject: null,
      summary,
      observedAt: null,
      source: "memory",
    })
  }

  return touches.slice(0, 12)
}

export function buildSequenceHistoryHaystack(input: GrowthSequenceSignalInput): string {
  return [
    ...(input.priorOutboundSubjects ?? []),
    ...(input.priorTouchSummaries ?? []),
    ...(input.sequenceHistorySummaries ?? []),
    ...(input.timelineEventSummaries ?? []),
    ...(input.memoryInteractionSummaries ?? []),
    ...(input.memoryAvoidRepeating ?? []),
    ...(input.priorReplySummaries ?? []),
  ]
    .join(" ")
    .toLowerCase()
}
