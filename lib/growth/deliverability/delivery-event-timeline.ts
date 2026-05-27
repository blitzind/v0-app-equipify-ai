import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthDeliveryTimelineEventType,
  GrowthDeliverabilityTimelineEntry,
} from "@/lib/growth/deliverability/deliverability-intelligence-types"

type TimelineRow = {
  id: string
  event_type: string
  normalized_type: string
  severity: string
  title: string
  summary: string | null
  sender_account_id: string | null
  domain_id: string | null
  mailbox_connection_id: string | null
  delivery_attempt_id: string | null
  provider_delivery_event_id: string | null
  provider_family: string | null
  dedupe_key: string
  raw_payload: Record<string, unknown>
  occurred_at: string
  created_at: string
}

function timelineTable(admin: SupabaseClient) {
  return admin.schema("growth").from("delivery_event_timeline")
}

const WEBHOOK_TYPE_MAP: Record<string, GrowthDeliveryTimelineEventType> = {
  sent: "sent",
  delivered: "delivered",
  delivery: "delivered",
  bounce: "bounced",
  hard_bounce: "bounced",
  soft_bounce: "bounced",
  complaint: "complained",
  spam: "complained",
  open: "opened",
  opened: "opened",
  click: "clicked",
  clicked: "clicked",
  unsubscribe: "unsubscribed",
  rejected: "provider_rejected",
  failed: "send_failure",
  throttle: "throttled",
  throttled: "throttled",
}

export function mapToDeliveryTimelineType(raw: string): GrowthDeliveryTimelineEventType {
  const key = raw.trim().toLowerCase()
  return WEBHOOK_TYPE_MAP[key] ?? "send_failure"
}

export async function recordDeliveryTimelineEvent(
  admin: SupabaseClient,
  input: {
    normalizedType: GrowthDeliveryTimelineEventType
    severity?: "low" | "medium" | "high" | "critical"
    title: string
    summary?: string | null
    senderAccountId?: string | null
    domainId?: string | null
    mailboxConnectionId?: string | null
    deliveryAttemptId?: string | null
    providerDeliveryEventId?: string | null
    providerFamily?: string | null
    dedupeKey: string
    occurredAt: string
    rawPayload?: Record<string, unknown>
    metadata?: Record<string, unknown>
  },
): Promise<GrowthDeliverabilityTimelineEntry | null> {
  const { error } = await timelineTable(admin).insert({
    event_type: input.normalizedType,
    normalized_type: input.normalizedType,
    severity: input.severity ?? "medium",
    title: input.title,
    summary: input.summary ?? null,
    sender_account_id: input.senderAccountId ?? null,
    domain_id: input.domainId ?? null,
    mailbox_connection_id: input.mailboxConnectionId ?? null,
    delivery_attempt_id: input.deliveryAttemptId ?? null,
    provider_delivery_event_id: input.providerDeliveryEventId ?? null,
    provider_family: input.providerFamily ?? null,
    dedupe_key: input.dedupeKey,
    raw_payload: { ...(input.rawPayload ?? {}), ...(input.metadata ?? {}) },
    occurred_at: input.occurredAt,
  })

  if (error) {
    if (error.code === "23505") return null
    console.error("[delivery-event-timeline]", error.message)
    return null
  }

  return {
    id: input.dedupeKey,
    normalizedType: input.normalizedType,
    severity: input.severity ?? "medium",
    title: input.title,
    summary: input.summary ?? null,
    occurredAt: input.occurredAt,
    providerFamily: input.providerFamily ?? null,
  }
}

export async function recordDeliveryTimelineFromWebhook(
  admin: SupabaseClient,
  input: {
    providerFamily: string
    normalizedEventType: string
    providerEventId: string
    providerDeliveryEventId?: string | null
    deliveryAttemptId?: string | null
    senderAccountId?: string | null
    occurredAt: string
    sanitizedPayload: Record<string, unknown>
  },
): Promise<void> {
  const normalizedType = mapToDeliveryTimelineType(input.normalizedEventType)
  const severity =
    normalizedType === "complained" || normalizedType === "bounced"
      ? "high"
      : normalizedType === "provider_rejected"
        ? "critical"
        : "medium"

  await recordDeliveryTimelineEvent(admin, {
    normalizedType,
    severity,
    title: `${input.providerFamily} ${normalizedType}`,
    summary: String(input.sanitizedPayload.summary ?? input.normalizedEventType),
    senderAccountId: input.senderAccountId,
    deliveryAttemptId: input.deliveryAttemptId,
    providerDeliveryEventId: input.providerDeliveryEventId,
    providerFamily: input.providerFamily,
    dedupeKey: `webhook:${input.providerFamily}:${input.providerEventId}`,
    occurredAt: input.occurredAt,
    rawPayload: input.sanitizedPayload,
  })
}

export async function listDeliveryTimelineEvents(
  admin: SupabaseClient,
  limit = 50,
): Promise<GrowthDeliverabilityTimelineEntry[]> {
  const { data, error } = await timelineTable(admin)
    .select("id, normalized_type, severity, title, summary, occurred_at, provider_family")
    .order("occurred_at", { ascending: false })
    .limit(limit)

  if (error) return []

  return ((data ?? []) as TimelineRow[]).map((row) => ({
    id: row.id,
    normalizedType: row.normalized_type as GrowthDeliveryTimelineEventType,
    severity: row.severity,
    title: row.title,
    summary: row.summary,
    occurredAt: row.occurred_at,
    providerFamily: row.provider_family,
  }))
}
