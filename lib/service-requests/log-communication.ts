import type { SupabaseClient } from "@supabase/supabase-js"
import { logCommunicationEvent } from "@/lib/notifications/log-event"

export async function logServiceRequestTimeline(args: {
  supabase: SupabaseClient
  organizationId: string
  serviceRequestId: string
  customerId: string | null
  title: string
  summary: string | null
  body?: string | null
  eventType: string
  createdBy: string | null
  metadata?: Record<string, unknown>
}): Promise<void> {
  await logCommunicationEvent(args.supabase, {
    organizationId: args.organizationId,
    channel: "system",
    direction: "outbound",
    eventType: args.eventType,
    title: args.title.slice(0, 240),
    summary: args.summary,
    body: args.body ?? null,
    audience: "organization",
    countsTowardUnread: true,
    deliveryStatus: "sent",
    recipientKind: args.customerId ? "customer" : "none",
    recipientCustomerId: args.customerId,
    relatedEntityType: "service_request",
    relatedEntityId: args.serviceRequestId,
    provider: "manual",
    metadata: { service_request_id: args.serviceRequestId, ...(args.metadata ?? {}) },
    createdBy: args.createdBy,
  })
}
