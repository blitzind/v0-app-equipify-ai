import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthLead } from "@/lib/growth/types"
import { classifyReplyIntent } from "@/lib/growth/reply-intelligence/reply-intent-classifier"
import { resolveReplyNextAction } from "@/lib/growth/reply-intelligence/reply-next-action-engine"
import {
  emitHighPriorityReplyNotification,
  emitMeetingRequestReceivedNotification,
  emitOwnerResponseGapNotification,
  emitReplyCompetitorMentionedNotification,
  emitReplyWaitingNotification,
  emitUnassignedReplyAttentionNotification,
} from "@/lib/growth/reply-intelligence/reply-intelligence-notifications"
import {
  emitMeetingRequestedTimeline,
  emitReplyAssignedTimeline,
  emitReplyClassifiedTimeline,
  emitReplyCompetitorDetectedTimeline,
  emitReplyFollowupCreatedTimeline,
  emitReplyReceivedTimeline,
} from "@/lib/growth/reply-intelligence/reply-intelligence-timeline-emitter"
import { scoreReplyPriorityFromClassification } from "@/lib/growth/reply-intelligence/reply-priority-scorer"
import { computeReplySlaDueAt, computeOwnerResponseGapMs } from "@/lib/growth/reply-intelligence/reply-sla-tracker"
import { computeReplyThreadIntelligence } from "@/lib/growth/reply-intelligence/reply-thread-intelligence"
import { processReplyMeetingIntelligence } from "@/lib/growth/meeting-intelligence/process-meeting-intelligence"
import type { GrowthReplyIntelligenceRecord } from "@/lib/growth/reply-intelligence/reply-intent-types"
import {
  listGrowthOutboundRepliesForLead,
  updateGrowthOutboundReplyIntelligence,
} from "@/lib/growth/outbound/reply-repository"
import type { GrowthOutboundReply } from "@/lib/growth/outbound/types"

function trimPhone(value: string | null | undefined): boolean {
  return Boolean(value?.trim())
}

export async function processReplyIntelligence(
  admin: SupabaseClient,
  input: {
    reply: GrowthOutboundReply
    lead: GrowthLead
    bodyPreview: string | null | undefined
    lastOutboundSentAt?: string | null
    hasCallablePhone: boolean
  },
): Promise<GrowthReplyIntelligenceRecord> {
  const priorReplies = (await listGrowthOutboundRepliesForLead(admin, input.lead.id, 50)).filter(
    (row) => row.id !== input.reply.id,
  )
  const classified = classifyReplyIntent(input.bodyPreview)
  const thread = computeReplyThreadIntelligence({
    currentReplyReceivedAt: input.reply.receivedAt,
    priorReplies,
    lastOutboundSentAt: input.lastOutboundSentAt,
  })
  const priority = scoreReplyPriorityFromClassification(classified, thread.threadReplyCount)
  const nextAction = resolveReplyNextAction({
    intent: classified.intent,
    priority,
    hasCallablePhone: input.hasCallablePhone,
    classification: classified,
  })
  const ownerUserId = input.lead.assignedTo ?? null
  const replySlaDueAt = computeReplySlaDueAt(input.reply.receivedAt, priority)
  const ownerGapMs = computeOwnerResponseGapMs(input.reply.receivedAt)

  const updated = await updateGrowthOutboundReplyIntelligence(admin, input.reply.id, {
    classification: classified.classification,
    sentiment: classified.sentiment,
    confidence: classified.confidence,
    intent: classified.intent,
    priority,
    nextAction,
    ownerUserId,
    threadReplyCount: thread.threadReplyCount,
    firstReplyAt: thread.firstReplyAt,
    lastReplyAt: thread.lastReplyAt,
    responseLatencyMs: thread.responseLatencyMs,
    unanswered: thread.unanswered,
    ownerWaiting: thread.ownerWaiting,
    replySlaDueAt,
    buyingSignals: classified.buyingSignals,
    objectionSignals: classified.objectionSignals,
    escalationSignals: classified.escalationSignals,
  })

  await emitReplyReceivedTimeline(admin, {
    leadId: input.lead.id,
    replyId: input.reply.id,
    intent: classified.intent,
    priority,
  })
  await emitReplyClassifiedTimeline(admin, {
    leadId: input.lead.id,
    replyId: input.reply.id,
    intent: classified.intent,
    priority,
    nextAction,
  })
  await emitReplyAssignedTimeline(admin, {
    leadId: input.lead.id,
    replyId: input.reply.id,
    ownerUserId,
  })
  await emitReplyFollowupCreatedTimeline(admin, {
    leadId: input.lead.id,
    replyId: input.reply.id,
    nextAction,
  })

  if (classified.intent === "meeting_request") {
    await emitMeetingRequestedTimeline(admin, { leadId: input.lead.id, replyId: input.reply.id })
    await processReplyMeetingIntelligence(admin, {
      leadId: input.lead.id,
      replyId: input.reply.id,
      companyName: input.lead.companyName,
      ownerUserId,
    })
    await emitMeetingRequestReceivedNotification(admin, {
      leadId: input.lead.id,
      replyId: input.reply.id,
      ownerUserId,
      companyName: input.lead.companyName,
    })
  }

  if (classified.intent === "competitor_mention") {
    await emitReplyCompetitorDetectedTimeline(admin, { leadId: input.lead.id, replyId: input.reply.id })
    await emitReplyCompetitorMentionedNotification(admin, {
      leadId: input.lead.id,
      replyId: input.reply.id,
      ownerUserId,
      companyName: input.lead.companyName,
    })
  }

  await emitReplyWaitingNotification(admin, {
    leadId: input.lead.id,
    replyId: input.reply.id,
    ownerUserId,
    companyName: input.lead.companyName,
    intent: classified.intent,
  })
  await emitHighPriorityReplyNotification(admin, {
    leadId: input.lead.id,
    replyId: input.reply.id,
    ownerUserId,
    companyName: input.lead.companyName,
    priority,
    intent: classified.intent,
  })
  await emitOwnerResponseGapNotification(admin, {
    leadId: input.lead.id,
    replyId: input.reply.id,
    ownerUserId,
    companyName: input.lead.companyName,
    gapMs: ownerGapMs,
  })

  if (!ownerUserId) {
    await emitUnassignedReplyAttentionNotification(admin, {
      leadId: input.lead.id,
      replyId: input.reply.id,
      companyName: input.lead.companyName,
      priority,
    })
  }

  return {
    replyId: updated.id,
    leadId: updated.leadId,
    ownerUserId,
    intent: classified.intent,
    priority,
    nextAction,
    threadReplyCount: thread.threadReplyCount,
    firstReplyAt: thread.firstReplyAt,
    lastReplyAt: thread.lastReplyAt,
    responseLatencyMs: thread.responseLatencyMs,
    unanswered: thread.unanswered,
    ownerWaiting: thread.ownerWaiting,
    replySlaDueAt,
    buyingSignals: classified.buyingSignals,
    objectionSignals: classified.objectionSignals,
    escalationSignals: classified.escalationSignals,
    companyName: input.lead.companyName,
    bodyPreview: updated.bodyPreview,
    receivedAt: updated.receivedAt,
    classification: updated.classification,
    confidence: updated.confidence,
  }
}

export function leadHasCallablePhone(lead: GrowthLead, dmPhone: string | null): boolean {
  return trimPhone(lead.contactPhone) || trimPhone(dmPhone)
}
