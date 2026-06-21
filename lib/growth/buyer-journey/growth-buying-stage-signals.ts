/** GS-AI-PLAYBOOK-4A — Buying stage signal normalization (client-safe). */

import type { OutreachContextPacket } from "@/lib/growth/outreach/personalization/personalization-types"

export type GrowthBuyingStageSignalInput = {
  leadStatus?: string | null
  opportunityStageKey?: string | null
  engagementScore?: number | null
  engagementTier?: string | null
  opportunityReadinessTier?: string | null
  buyingIntent?: string | null
  relationshipStage?: string | null
  priorTouchCount?: number
  priorReplyCount?: number
  priorMeetingCount?: number
  daysSinceLastTouch?: number | null
  emailOpens?: number
  emailClicks?: number
  callsCompleted?: number
  sharePageViews?: number
  videoCompletion?: boolean
  calendarBookings?: number
  memoryAvailable?: boolean
  memoryCoverageScore?: number | null
  memoryOpenLoops?: string[]
  memoryCommitteeSummaries?: string[]
  memoryUnresolvedObjectionCount?: number
  sequenceActive?: boolean
  sequenceStepIndex?: number | null
  researchPainPoints?: string[]
  objectionSummaries?: string[]
  timelineEventSummaries?: string[]
  isExistingCustomer?: boolean
}

export function buildBuyingStageSignalsFromContextPacket(
  packet: OutreachContextPacket,
  extras?: Partial<GrowthBuyingStageSignalInput>,
): GrowthBuyingStageSignalInput {
  return {
    leadStatus: extras?.leadStatus ?? null,
    opportunityStageKey: extras?.opportunityStageKey ?? null,
    engagementScore: packet.engagementScore ?? extras?.engagementScore ?? null,
    engagementTier: extras?.engagementTier ?? null,
    opportunityReadinessTier: packet.opportunityReadinessTier ?? extras?.opportunityReadinessTier ?? null,
    buyingIntent: packet.buyingIntent ?? extras?.buyingIntent ?? null,
    relationshipStage: packet.relationshipStage ?? extras?.relationshipStage ?? null,
    priorTouchCount: packet.priorTouchCount ?? extras?.priorTouchCount ?? 0,
    priorReplyCount: packet.priorReplySummaries.length ?? extras?.priorReplyCount ?? 0,
    priorMeetingCount:
      (packet.memoryCommitmentSummaries.length > 0 ? 1 : 0) + (extras?.priorMeetingCount ?? 0),
    daysSinceLastTouch: extras?.daysSinceLastTouch ?? null,
    emailOpens: extras?.emailOpens ?? 0,
    emailClicks: extras?.emailClicks ?? 0,
    callsCompleted: extras?.callsCompleted ?? 0,
    sharePageViews: extras?.sharePageViews ?? 0,
    videoCompletion: extras?.videoCompletion ?? false,
    calendarBookings: extras?.calendarBookings ?? 0,
    memoryAvailable: packet.memoryAvailable ?? extras?.memoryAvailable ?? false,
    memoryCoverageScore: packet.memoryCoverageScore ?? extras?.memoryCoverageScore ?? null,
    memoryOpenLoops: packet.memoryOpenLoopSummaries ?? extras?.memoryOpenLoops ?? [],
    memoryCommitteeSummaries: packet.memoryCommitteeSummaries ?? extras?.memoryCommitteeSummaries ?? [],
    memoryUnresolvedObjectionCount:
      packet.memoryUnresolvedObjectionCount ?? extras?.memoryUnresolvedObjectionCount ?? 0,
    sequenceActive: extras?.sequenceActive ?? packet.sequenceHistorySummaries.length > 0,
    sequenceStepIndex: extras?.sequenceStepIndex ?? null,
    researchPainPoints: packet.researchPainPoints ?? extras?.researchPainPoints ?? [],
    objectionSummaries: packet.objectionSummaries ?? extras?.objectionSummaries ?? [],
    timelineEventSummaries: packet.timelineEventSummaries ?? extras?.timelineEventSummaries ?? [],
    isExistingCustomer: extras?.isExistingCustomer ?? packet.relationshipStage === "customer",
  }
}

export function summarizeBuyingStageSignalHaystack(signals: GrowthBuyingStageSignalInput): string {
  return [
    signals.leadStatus,
    signals.opportunityStageKey,
    signals.engagementTier,
    signals.opportunityReadinessTier,
    signals.buyingIntent,
    signals.relationshipStage,
    ...(signals.researchPainPoints ?? []),
    ...(signals.objectionSummaries ?? []),
    ...(signals.timelineEventSummaries ?? []),
    ...(signals.memoryOpenLoops ?? []),
    ...(signals.memoryCommitteeSummaries ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}
