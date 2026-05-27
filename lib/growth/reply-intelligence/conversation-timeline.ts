import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthConversationTimelineEntry } from "@/lib/growth/reply-intelligence/reply-intent-types"
import { GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER } from "@/lib/growth/reply-intelligence/reply-intent-types"

function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const blocked = new Set(["raw_payload", "provider_secret", "access_token", "refresh_token", "oauth"])
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (blocked.has(key)) continue
    if (typeof value === "string" && value.length > 500) {
      sanitized[key] = `${value.slice(0, 500)}…`
      continue
    }
    sanitized[key] = value
  }
  return sanitized
}

export async function fetchLeadConversationTimeline(
  admin: SupabaseClient,
  input: { leadId: string; limit?: number },
): Promise<{ qaMarker: typeof GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER; entries: GrowthConversationTimelineEntry[] }> {
  const limit = input.limit ?? 100

  const [conversationRes, leadTimelineRes, repliesRes] = await Promise.all([
    admin
      .schema("growth")
      .from("conversation_timeline_events")
      .select("id, event_kind, event_source, title, summary, evidence_excerpt, occurred_at, payload")
      .eq("lead_id", input.leadId)
      .order("occurred_at", { ascending: false })
      .limit(limit),
    admin
      .schema("growth")
      .from("lead_timeline_events")
      .select("id, event_type, title, summary, created_at, payload")
      .eq("lead_id", input.leadId)
      .in("event_type", [
        "email_sent",
        "email_delivered",
        "email_opened",
        "email_clicked",
        "email_replied",
        "reply_received",
        "reply_classified",
        "reply_buying_signal_detected",
        "reply_objection_detected",
        "reply_workflow_routed",
        "reply_suppression_applied",
        "reply_copilot_assisted",
        "reply_ingested",
        "reply_draft_generated",
        "reply_draft_approved",
        "follow_up_created",
        "email_suppressed",
        "sequence_enrollment_cancelled",
        "sequence_step_skipped",
      ])
      .order("created_at", { ascending: false })
      .limit(limit),
    admin
      .schema("growth")
      .from("outbound_replies")
      .select("id, body_preview, received_at, intent, classification_v2, buying_signals, objection_signals")
      .eq("lead_id", input.leadId)
      .order("received_at", { ascending: false })
      .limit(20),
  ])

  if (conversationRes.error) throw new Error(conversationRes.error.message)
  if (leadTimelineRes.error) throw new Error(leadTimelineRes.error.message)
  if (repliesRes.error) throw new Error(repliesRes.error.message)

  const entries: GrowthConversationTimelineEntry[] = []

  for (const row of conversationRes.data ?? []) {
    const record = row as Record<string, unknown>
    entries.push({
      id: String(record.id),
      eventKind: String(record.event_kind),
      eventSource: String(record.event_source),
      title: String(record.title),
      summary: String(record.summary),
      evidenceExcerpt: (record.evidence_excerpt as string | null) ?? null,
      occurredAt: String(record.occurred_at),
      payload: sanitizePayload((record.payload as Record<string, unknown>) ?? {}),
    })
  }

  for (const row of leadTimelineRes.data ?? []) {
    const record = row as Record<string, unknown>
    entries.push({
      id: `lead:${String(record.id)}`,
      eventKind: String(record.event_type),
      eventSource: "lead_timeline",
      title: String(record.title),
      summary: String(record.summary ?? ""),
      evidenceExcerpt: null,
      occurredAt: String(record.created_at),
      payload: sanitizePayload((record.payload as Record<string, unknown>) ?? {}),
    })
  }

  for (const row of repliesRes.data ?? []) {
    const record = row as Record<string, unknown>
    entries.push({
      id: `reply:${String(record.id)}`,
      eventKind: "inbound_reply",
      eventSource: "outbound_replies",
      title: "Inbound reply",
      summary: `Intent: ${String(record.intent ?? "unknown")}`,
      evidenceExcerpt: (record.body_preview as string | null)?.slice(0, 240) ?? null,
      occurredAt: String(record.received_at),
      payload: sanitizePayload({
        intent: record.intent,
        buying_signals: record.buying_signals,
        objection_signals: record.objection_signals,
        classification_v2: record.classification_v2,
      }),
    })
  }

  entries.sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))

  return {
    qaMarker: GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER,
    entries: entries.slice(0, limit),
  }
}
