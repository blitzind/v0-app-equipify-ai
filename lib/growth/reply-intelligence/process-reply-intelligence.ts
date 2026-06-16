import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthLead } from "@/lib/growth/types"
import { extractBuyingSignals } from "@/lib/growth/reply-intelligence/buying-signal-extractor"
import { recordCampaignReplyLearning } from "@/lib/growth/reply-intelligence/campaign-reply-learning"
import { processRevenueIntelligence } from "@/lib/growth/revenue-intelligence/process-revenue-intelligence"
import { applyReplyComplianceHardening } from "@/lib/growth/reply-intelligence/reply-compliance-hardening"
import { buildReplyCopilotAssist, mapMemoryInfluenceToReplyCopilotRelationship } from "@/lib/growth/reply-intelligence/reply-copilot-service"
import { buildLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-influence-context"
import { classifyReplyIntentV2 } from "@/lib/growth/reply-intelligence/reply-intent-classifier-v2"
import { insertConversationTimelineEvent } from "@/lib/growth/reply-intelligence/reply-ingestion-repository"
import { detectReplyObjections } from "@/lib/growth/reply-intelligence/objection-detection"
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
import { scoreReplyPriorityFromClassificationV2 } from "@/lib/growth/reply-intelligence/reply-priority-scorer"
import { routeReplyWorkflows } from "@/lib/growth/reply-intelligence/reply-routing-workflows"
import { computeReplySlaDueAt, computeOwnerResponseGapMs } from "@/lib/growth/reply-intelligence/reply-sla-tracker"
import { computeReplyThreadIntelligence } from "@/lib/growth/reply-intelligence/reply-thread-intelligence"
import { processReplyMeetingIntelligence } from "@/lib/growth/meeting-intelligence/process-meeting-intelligence"
import { emitReplyOperatorNotificationsFromIntelligence } from "@/lib/growth/reply-intelligence/reply-operator-notifications"
import type { GrowthReplyIntelligenceRecord } from "@/lib/growth/reply-intelligence/reply-intent-types"
import {
  listGrowthOutboundRepliesForLead,
  updateGrowthOutboundReplyIntelligence,
} from "@/lib/growth/outbound/reply-repository"
import type { GrowthOutboundReply } from "@/lib/growth/outbound/types"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"

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
    senderEmail?: string | null
    sequenceEnrollmentId?: string | null
    campaignId?: string | null
    ingestionEventId?: string | null
  },
): Promise<GrowthReplyIntelligenceRecord> {
  const priorReplies = (await listGrowthOutboundRepliesForLead(admin, input.lead.id, 50)).filter(
    (row) => row.id !== input.reply.id,
  )
  const classified = classifyReplyIntentV2(input.bodyPreview)
  const buyingSignalsDetailed = extractBuyingSignals(input.bodyPreview)
  const objectionsDetailed = detectReplyObjections(input.bodyPreview)
  const thread = computeReplyThreadIntelligence({
    currentReplyReceivedAt: input.reply.receivedAt,
    priorReplies,
    lastOutboundSentAt: input.lastOutboundSentAt,
  })
  const priority = scoreReplyPriorityFromClassificationV2(classified, thread.threadReplyCount)
  const nextAction = resolveReplyNextAction({
    intent: classified.intent,
    priority,
    hasCallablePhone: input.hasCallablePhone,
    classification: classified,
  })
  const ownerUserId = input.lead.assignedTo ?? null
  const replySlaDueAt = computeReplySlaDueAt(input.reply.receivedAt, priority)
  const ownerGapMs = computeOwnerResponseGapMs(input.reply.receivedAt)

  const legacyBuyingSignals = classified.buyingSignals
  const legacyObjectionSignals = classified.objectionSignals

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
    buyingSignals: legacyBuyingSignals,
    objectionSignals: legacyObjectionSignals,
    escalationSignals: classified.escalationSignals,
    classificationV2: {
      classificationReason: classified.classificationReason,
      matchedPhrases: classified.matchedPhrases,
      confidenceTier: classified.confidenceTier,
      uncertaintyState: classified.uncertaintyState,
      recommendedOperatorAction: classified.recommendedOperatorAction,
      aiAssisted: false,
      buyingSignals: buyingSignalsDetailed,
      objections: objectionsDetailed,
    },
    confidenceTier: classified.confidenceTier,
    uncertaintyState: classified.uncertaintyState,
    matchedPhrases: classified.matchedPhrases,
    recommendedOperatorAction: classified.recommendedOperatorAction,
    ingestionSource: input.reply.rawPayload?.ingestion_source as string | undefined,
    ingestionEventId: input.ingestionEventId ?? (input.reply.rawPayload?.ingestion_event_id as string | undefined) ?? null,
  })

  for (const signal of buyingSignalsDetailed) {
    await insertConversationTimelineEvent(admin, {
      leadId: input.lead.id,
      eventKind: "buying_signal",
      eventSource: "reply_intelligence_v2",
      title: "Buying signal detected",
      summary: signal.signal.replace(/_/g, " "),
      evidenceExcerpt: signal.excerpt,
      occurredAt: input.reply.receivedAt,
      outboundReplyId: input.reply.id,
      ingestionEventId: input.ingestionEventId ?? null,
      payload: { signal: signal.signal, confidence: signal.confidence },
    }).catch(() => undefined)

    await appendGrowthLeadTimelineEvent(admin, {
      leadId: input.lead.id,
      eventType: "reply_buying_signal_detected",
      title: "Reply buying signal",
      summary: signal.signal.replace(/_/g, " "),
      outboundReplyId: input.reply.id,
      payload: { signal: signal.signal, excerpt: signal.excerpt },
    }).catch(() => undefined)
  }

  for (const objection of objectionsDetailed) {
    await insertConversationTimelineEvent(admin, {
      leadId: input.lead.id,
      eventKind: "objection",
      eventSource: "reply_intelligence_v2",
      title: "Objection detected",
      summary: objection.summary,
      evidenceExcerpt: objection.excerpt,
      occurredAt: input.reply.receivedAt,
      outboundReplyId: input.reply.id,
      payload: { category: objection.category, confidence: objection.confidence },
    }).catch(() => undefined)

    await appendGrowthLeadTimelineEvent(admin, {
      leadId: input.lead.id,
      eventType: "reply_objection_detected",
      title: "Reply objection",
      summary: objection.summary,
      outboundReplyId: input.reply.id,
      payload: { category: objection.category, excerpt: objection.excerpt },
    }).catch(() => undefined)
  }

  const copilotMemory = await buildLeadMemoryInfluenceContext(admin, input.lead.id).catch(() => null)

  const copilot = buildReplyCopilotAssist({
    bodyPreview: input.bodyPreview,
    companyName: input.lead.companyName,
    contactLabel: input.lead.contactName,
    relationshipMemory: mapMemoryInfluenceToReplyCopilotRelationship(copilotMemory),
  })

  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.lead.id,
    eventType: "reply_copilot_assisted",
    title: "Reply copilot assist",
    summary: copilot.summary,
    outboundReplyId: input.reply.id,
    payload: {
      assisted_label: copilot.assistedLabel,
      suggested_next_step: copilot.suggestedNextStep,
      confidence_tier: copilot.confidenceTier,
    },
  }).catch(() => undefined)

  await routeReplyWorkflows(admin, {
    leadId: input.lead.id,
    replyId: input.reply.id,
    ingestionEventId: input.ingestionEventId ?? null,
    nextAction,
    classification: classified,
    senderEmail: input.senderEmail,
    contactId: input.reply.contactId,
    sequenceEnrollmentId: input.sequenceEnrollmentId,
    actorUserId: ownerUserId,
  })

  await applyReplyComplianceHardening(admin, {
    leadId: input.lead.id,
    replyId: input.reply.id,
    bodyPreview: input.bodyPreview,
    classification: classified,
    senderEmail: input.senderEmail,
    sequenceEnrollmentId: input.sequenceEnrollmentId,
  })

  await recordCampaignReplyLearning(admin, {
    campaignId: input.campaignId,
    sequenceEnrollmentId: input.sequenceEnrollmentId,
    classification: classified,
  }).catch(() => undefined)

  await processRevenueIntelligence(admin, {
    leadId: input.lead.id,
    replyId: input.reply.id,
    companyName: input.lead.companyName,
    bodyPreview: input.bodyPreview,
    classification: classified,
    buyingSignals: buyingSignalsDetailed,
    objections: objectionsDetailed,
    threadReplyCount: thread.threadReplyCount,
    responseLatencyMs: thread.responseLatencyMs,
    recommendedOperatorAction: classified.recommendedOperatorAction,
    campaignId: input.campaignId,
    sequenceEnrollmentId: input.sequenceEnrollmentId,
    receivedAt: input.reply.receivedAt,
  }).catch(() => undefined)

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

  if (classified.intent === "meeting_request" || classified.intent === "demo_request") {
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

  await emitReplyOperatorNotificationsFromIntelligence(admin, {
    replyId: input.reply.id,
    leadId: input.lead.id,
    organizationId: input.lead.promotedOrganizationId,
    companyLabel: input.lead.companyName,
    intent: classified.intent,
    priority,
    leadOwnerUserId: ownerUserId,
    receivedAt: input.reply.receivedAt,
    buyingSignalCount: buyingSignalsDetailed.length,
  }).catch(() => undefined)

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
    buyingSignals: legacyBuyingSignals,
    objectionSignals: legacyObjectionSignals,
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
