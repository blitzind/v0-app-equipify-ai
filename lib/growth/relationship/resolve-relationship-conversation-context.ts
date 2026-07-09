/**
 * GE-AIOS-15D — Resolve latest conversation context for relationship graph (server-only).
 * Reads existing inbox + timeline systems only — no duplicate conversation store.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { RelationshipLeadSnapshot } from "@/lib/growth/relationship/relationship-lead-snapshot-types"
import { GROWTH_RELATIONSHIP_LEAD_SNAPSHOT_QA_MARKER } from "@/lib/growth/relationship/relationship-lead-snapshot-types"
import { resolveRelationshipStateContext } from "@/lib/growth/relationship/resolve-relationship-state-context"

const TIMELINE_SUMMARY_LIMIT = 3 as const

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function buildTimelineSummary(
  entries: Array<{ title: string; summary: string; occurredAt: string }>,
): string | null {
  if (entries.length === 0) return null
  return entries
    .slice(0, TIMELINE_SUMMARY_LIMIT)
    .map((entry) => {
      const summary = entry.summary.trim() || entry.title.trim()
      return summary ? summary.replace(/\.$/, "") : null
    })
    .filter(Boolean)
    .join(" · ")
}

export async function resolveRelationshipConversationContext(
  admin: SupabaseClient,
  leadId: string,
): Promise<Partial<RelationshipLeadSnapshot>> {
  const id = asString(leadId)
  if (!id) return {}

  const [threadRes, replyRes, timelineRes, leadRes] = await Promise.all([
    admin
      .schema("growth")
      .from("inbox_threads")
      .select("id, thread_status, last_message_at, reply_count, sla_due_at")
      .eq("lead_id", id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    admin
      .schema("growth")
      .from("outbound_replies")
      .select("id, received_at, intent, classification_v2")
      .eq("lead_id", id)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .schema("growth")
      .from("conversation_timeline_events")
      .select("title, summary, occurred_at")
      .eq("lead_id", id)
      .order("occurred_at", { ascending: false })
      .limit(5),
    admin
      .schema("growth")
      .from("leads")
      .select("conversation_summary, conversation_sentiment, conversation_last_meaningful_conversation_at")
      .eq("id", id)
      .maybeSingle(),
  ])

  if (threadRes.error) throw new Error(threadRes.error.message)
  if (replyRes.error) throw new Error(replyRes.error.message)
  if (timelineRes.error) throw new Error(timelineRes.error.message)
  if (leadRes.error) throw new Error(leadRes.error.message)

  const thread = (threadRes.data as Record<string, unknown> | null) ?? null
  const reply = (replyRes.data as Record<string, unknown> | null) ?? null
  const lead = (leadRes.data as Record<string, unknown> | null) ?? null

  const timelineEntries = (timelineRes.data ?? []).map((row) => {
    const record = row as Record<string, unknown>
    return {
      title: asString(record.title),
      summary: asString(record.summary),
      occurredAt: asString(record.occurred_at),
    }
  })

  const latestReplyAt =
    asString(reply?.received_at) ||
    asString(lead?.conversation_last_meaningful_conversation_at) ||
    null

  const latestReplySentiment =
    asString(reply?.intent) || asString(lead?.conversation_sentiment) || null

  const conversationSummary =
    asString(lead?.conversation_summary) ||
    buildTimelineSummary(timelineEntries) ||
    null

  const threadStatus = asString(thread?.thread_status)
  const waitingOnCustomer = threadStatus === "waiting"
  const waitingOnOperator = threadStatus === "needs_review" || threadStatus === "open"

  return {
    qa_marker: GROWTH_RELATIONSHIP_LEAD_SNAPSHOT_QA_MARKER,
    lead_id: id,
    latest_conversation_thread_id: asString(thread?.id) || null,
    latest_conversation_status: threadStatus || null,
    latest_reply_at: latestReplyAt,
    latest_reply_sentiment: latestReplySentiment,
    conversation_timeline_summary: conversationSummary,
    next_touch_at: asString(thread?.sla_due_at) || null,
    follow_up_due_at: asString(thread?.sla_due_at) || null,
    waiting_on_customer: waitingOnCustomer,
    waiting_on_operator: waitingOnOperator,
    conversation_context_available: Boolean(thread || reply || timelineEntries.length > 0 || conversationSummary),
  }
}

export async function resolveRelationshipLeadSnapshot(
  admin: SupabaseClient,
  leadId: string,
): Promise<RelationshipLeadSnapshot | null> {
  const state = await resolveRelationshipStateContext(admin, leadId)
  if (!state) return null

  const conversation = await resolveRelationshipConversationContext(admin, leadId)
  return {
    ...state,
    ...conversation,
    lead_id: leadId,
    qa_marker: GROWTH_RELATIONSHIP_LEAD_SNAPSHOT_QA_MARKER,
    waiting_on_operator: state.waiting_on_operator || conversation.waiting_on_operator === true,
    waiting_on_customer: state.waiting_on_customer || conversation.waiting_on_customer === true,
    last_meaningful_touch_at:
      state.last_meaningful_touch_at || conversation.latest_reply_at || null,
    memory_context_available: state.memory_context_available,
    conversation_context_available: conversation.conversation_context_available ?? false,
  }
}
