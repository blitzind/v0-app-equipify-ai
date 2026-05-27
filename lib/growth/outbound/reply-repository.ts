import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthOutboundReply,
  GrowthOutboundReplyClassification,
  GrowthOutboundReplySentiment,
} from "@/lib/growth/outbound/types"
import { GROWTH_OUTBOUND_BODY_PREVIEW_MAX } from "@/lib/growth/outbound/constants"
import type {
  GrowthReplyInboxView,
  GrowthReplyIntent,
  GrowthReplyNextAction,
  GrowthReplyPriority,
  GrowthReplySalesExecutionView,
} from "@/lib/growth/reply-intelligence/reply-intent-types"

type ReplyDbRow = {
  id: string
  connection_id: string
  message_id: string | null
  contact_id: string | null
  lead_id: string
  message_event_id: string
  provider_reply_id: string | null
  received_at: string
  body_preview: string | null
  classification: string
  sentiment: string
  confidence: number
  classification_locked: boolean
  classification_locked_by: string | null
  intent: string | null
  priority: string
  next_action: string | null
  owner_user_id: string | null
  thread_reply_count: number
  first_reply_at: string | null
  last_reply_at: string | null
  response_latency_ms: number | null
  unanswered: boolean
  owner_waiting: boolean
  reply_sla_due_at: string | null
  buying_signals: string[] | null
  objection_signals: string[] | null
  escalation_signals: string[] | null
  intelligence_processed_at: string | null
  raw_payload: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export const REPLY_SELECT =
  "id, connection_id, message_id, contact_id, lead_id, message_event_id, provider_reply_id, received_at, body_preview, classification, sentiment, confidence, classification_locked, classification_locked_by, intent, priority, next_action, owner_user_id, thread_reply_count, first_reply_at, last_reply_at, response_latency_ms, unanswered, owner_waiting, reply_sla_due_at, buying_signals, objection_signals, escalation_signals, intelligence_processed_at, raw_payload, created_at, updated_at"

function repliesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("outbound_replies")
}

function mapRow(row: ReplyDbRow): GrowthOutboundReply {
  return {
    id: row.id,
    connectionId: row.connection_id,
    messageId: row.message_id,
    contactId: row.contact_id,
    leadId: row.lead_id,
    messageEventId: row.message_event_id,
    providerReplyId: row.provider_reply_id,
    receivedAt: row.received_at,
    bodyPreview: row.body_preview,
    classification: row.classification as GrowthOutboundReplyClassification,
    sentiment: row.sentiment as GrowthOutboundReplySentiment,
    confidence: Number(row.confidence),
    classificationLocked: row.classification_locked,
    classificationLockedBy: row.classification_locked_by,
    intent: row.intent,
    priority: row.priority ?? "low",
    nextAction: row.next_action,
    ownerUserId: row.owner_user_id,
    threadReplyCount: row.thread_reply_count ?? 1,
    firstReplyAt: row.first_reply_at,
    lastReplyAt: row.last_reply_at,
    responseLatencyMs: row.response_latency_ms,
    unanswered: row.unanswered ?? true,
    ownerWaiting: row.owner_waiting ?? false,
    replySlaDueAt: row.reply_sla_due_at,
    buyingSignals: row.buying_signals ?? [],
    objectionSignals: row.objection_signals ?? [],
    escalationSignals: row.escalation_signals ?? [],
    intelligenceProcessedAt: row.intelligence_processed_at,
    rawPayload: row.raw_payload ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function insertGrowthOutboundReply(
  admin: SupabaseClient,
  input: {
    connectionId: string
    messageId?: string | null
    contactId?: string | null
    leadId: string
    messageEventId: string
    providerReplyId?: string | null
    receivedAt: string
    bodyPreview?: string | null
    classification: GrowthOutboundReplyClassification
    sentiment: GrowthOutboundReplySentiment
    confidence: number
    rawPayload?: Record<string, unknown>
  },
): Promise<GrowthOutboundReply> {
  const { data, error } = await repliesTable(admin)
    .insert({
      connection_id: input.connectionId,
      message_id: input.messageId ?? null,
      contact_id: input.contactId ?? null,
      lead_id: input.leadId,
      message_event_id: input.messageEventId,
      provider_reply_id: input.providerReplyId ?? null,
      received_at: input.receivedAt,
      body_preview: input.bodyPreview?.trim().slice(0, GROWTH_OUTBOUND_BODY_PREVIEW_MAX) ?? null,
      classification: input.classification,
      sentiment: input.sentiment,
      confidence: input.confidence,
      raw_payload: input.rawPayload ?? {},
    })
    .select(REPLY_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data as ReplyDbRow)
}

export async function updateGrowthOutboundReplyIntelligence(
  admin: SupabaseClient,
  replyId: string,
  input: {
    classification: GrowthOutboundReplyClassification
    sentiment: GrowthOutboundReplySentiment
    confidence: number
    intent: GrowthReplyIntent
    priority: GrowthReplyPriority
    nextAction: GrowthReplyNextAction
    ownerUserId: string | null
    threadReplyCount: number
    firstReplyAt: string | null
    lastReplyAt: string
    responseLatencyMs: number | null
    unanswered: boolean
    ownerWaiting: boolean
    replySlaDueAt: string
    buyingSignals: string[]
    objectionSignals: string[]
    escalationSignals: string[]
    classificationV2?: Record<string, unknown> | null
    confidenceTier?: string | null
    uncertaintyState?: string | null
    matchedPhrases?: unknown[] | null
    recommendedOperatorAction?: string | null
    ingestionSource?: string | null
    ingestionEventId?: string | null
  },
): Promise<GrowthOutboundReply> {
  const now = new Date().toISOString()
  const { data, error } = await repliesTable(admin)
    .update({
      classification: input.classification,
      sentiment: input.sentiment,
      confidence: input.confidence,
      intent: input.intent,
      priority: input.priority,
      next_action: input.nextAction,
      owner_user_id: input.ownerUserId,
      thread_reply_count: input.threadReplyCount,
      first_reply_at: input.firstReplyAt,
      last_reply_at: input.lastReplyAt,
      response_latency_ms: input.responseLatencyMs,
      unanswered: input.unanswered,
      owner_waiting: input.ownerWaiting,
      reply_sla_due_at: input.replySlaDueAt,
      buying_signals: input.buyingSignals,
      objection_signals: input.objectionSignals,
      escalation_signals: input.escalationSignals,
      classification_v2: input.classificationV2 ?? null,
      confidence_tier: input.confidenceTier ?? null,
      uncertainty_state: input.uncertaintyState ?? null,
      matched_phrases: input.matchedPhrases ?? [],
      recommended_operator_action: input.recommendedOperatorAction ?? null,
      ingestion_source: input.ingestionSource ?? null,
      ingestion_event_id: input.ingestionEventId ?? null,
      intelligence_processed_at: now,
      updated_at: now,
    })
    .eq("id", replyId)
    .select(REPLY_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data as ReplyDbRow)
}

export async function listGrowthOutboundRepliesForLead(
  admin: SupabaseClient,
  leadId: string,
  limit = 20,
): Promise<GrowthOutboundReply[]> {
  const { data, error } = await repliesTable(admin)
    .select(REPLY_SELECT)
    .eq("lead_id", leadId)
    .order("received_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return ((data ?? []) as ReplyDbRow[]).map(mapRow)
}

export type GrowthReplyInboxQuery = {
  view?: GrowthReplyInboxView
  salesExecutionView?: GrowthReplySalesExecutionView
  ownerUserId?: string | null
  intent?: GrowthReplyIntent
  priority?: GrowthReplyPriority
  unanswered?: boolean
  meetingRequested?: boolean
  competitorMention?: boolean
  since?: string
  limit?: number
  offset?: number
}

export type GrowthReplyInboxItem = GrowthOutboundReply & {
  companyName: string | null
}

export async function listGrowthReplyInbox(
  admin: SupabaseClient,
  query: GrowthReplyInboxQuery,
): Promise<{ items: GrowthReplyInboxItem[]; total: number }> {
  const limit = query.limit ?? 25
  const offset = query.offset ?? 0

  let request = repliesTable(admin)
    .select(REPLY_SELECT, { count: "exact" })
    .order("received_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (query.view === "my_inbox" && query.ownerUserId) {
    request = request.eq("owner_user_id", query.ownerUserId)
  }
  if (query.view === "needs_action") {
    request = request.in("next_action", ["call_prospect", "reply_email", "schedule_meeting", "manual_review"])
  }
  if (query.view === "unanswered") {
    request = request.eq("unanswered", true)
  }
  if (query.view === "meeting_intent") {
    request = request.eq("intent", "meeting_request")
  }
  if (query.view === "objections") {
    request = request.eq("intent", "objection")
  }
  if (query.view === "high_priority") {
    request = request.in("priority", ["critical", "high"])
  }
  if (query.view === "competitor_mentions") {
    request = request.eq("intent", "competitor_mention")
  }
  if (query.view === "waiting_on_prospect") {
    request = request.eq("owner_waiting", true)
  }

  if (query.salesExecutionView === "needs_review") {
    request = request.or("confidence_tier.in.(low,uncertain),uncertainty_state.eq.ambiguous,unanswered.eq.true")
  }
  if (query.salesExecutionView === "interested") {
    request = request.in("intent", ["positive_interest", "meeting_request", "demo_request"])
  }
  if (query.salesExecutionView === "demo_requests") {
    request = request.in("intent", ["demo_request", "meeting_request"])
  }
  if (query.salesExecutionView === "pricing_questions") {
    request = request.eq("intent", "pricing_question")
  }
  if (query.salesExecutionView === "objection_heavy") {
    request = request.in("intent", ["objection", "timing_delay", "competitor_mention", "angry_complaint"])
  }
  if (query.salesExecutionView === "stop_unsubscribe") {
    request = request.in("intent", ["unsubscribe", "not_interested", "wrong_contact"])
  }
  if (query.salesExecutionView === "angry_complaint") {
    request = request.eq("intent", "angry_complaint")
  }
  if (query.salesExecutionView === "low_confidence") {
    request = request.in("confidence_tier", ["low", "uncertain"])
  }

  if (query.ownerUserId && query.view !== "my_inbox") {
    request = request.eq("owner_user_id", query.ownerUserId)
  }
  if (query.intent) request = request.eq("intent", query.intent)
  if (query.priority) request = request.eq("priority", query.priority)
  if (query.unanswered === true) request = request.eq("unanswered", true)
  if (query.meetingRequested) request = request.eq("intent", "meeting_request")
  if (query.competitorMention) request = request.eq("intent", "competitor_mention")
  if (query.since) request = request.gte("received_at", query.since)

  const { data, error, count } = await request
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as ReplyDbRow[]
  const leadIds = [...new Set(rows.map((row) => row.lead_id))]
  const companyNames = new Map<string, string>()
  if (leadIds.length > 0) {
    const { data: leads, error: leadsError } = await admin
      .schema("growth")
      .from("leads")
      .select("id, company_name")
      .in("id", leadIds)
    if (leadsError) throw new Error(leadsError.message)
    for (const lead of (leads ?? []) as Array<{ id: string; company_name: string }>) {
      companyNames.set(lead.id, lead.company_name)
    }
  }

  const items = rows.map((row) => ({
    ...mapRow(row),
    companyName: companyNames.get(row.lead_id) ?? null,
  }))

  return { items, total: count ?? items.length }
}

export async function overrideGrowthOutboundReplyClassification(
  admin: SupabaseClient,
  replyId: string,
  input: {
    classification: GrowthOutboundReplyClassification
    sentiment: GrowthOutboundReplySentiment
    lockedBy: string
  },
): Promise<GrowthOutboundReply | null> {
  const { data, error } = await repliesTable(admin)
    .update({
      classification: input.classification,
      sentiment: input.sentiment,
      classification_locked: true,
      classification_locked_by: input.lockedBy,
      confidence: 1,
    })
    .eq("id", replyId)
    .select(REPLY_SELECT)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapRow(data as ReplyDbRow) : null
}

export async function reassignGrowthReplyOwner(
  admin: SupabaseClient,
  replyId: string,
  ownerUserId: string | null,
): Promise<GrowthOutboundReply | null> {
  const { data, error } = await repliesTable(admin)
    .update({ owner_user_id: ownerUserId, updated_at: new Date().toISOString() })
    .eq("id", replyId)
    .select(REPLY_SELECT)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRow(data as ReplyDbRow) : null
}
