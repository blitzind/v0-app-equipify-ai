import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createDeliveryEvent } from "@/lib/growth/providers/provider-events"
import type { GrowthTransportTimelineEventType } from "@/lib/growth/providers/adapters/provider-adapter-types"

function timelineTable(admin: SupabaseClient) {
  return admin.schema("growth").from("platform_timeline_events")
}

export async function appendTransportTimelineEvent(
  admin: SupabaseClient,
  input: {
    eventType: GrowthTransportTimelineEventType
    title: string
    summary?: string | null
    providerId?: string | null
    attemptId?: string | null
    payload?: Record<string, unknown>
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<void> {
  const { error } = await timelineTable(admin).insert({
    connection_id: null,
    event_type: input.eventType,
    title: input.title,
    summary: input.summary ?? null,
    payload: {
      ...(input.payload ?? {}),
      provider_id: input.providerId ?? null,
      delivery_attempt_id: input.attemptId ?? null,
    },
    actor_user_id: input.actorUserId ?? null,
    actor_email: input.actorEmail ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function recordTransportAuditEvent(
  admin: SupabaseClient,
  input: {
    provider_id: string
    event_type: GrowthTransportTimelineEventType
    title: string
    description: string
    severity?: "low" | "medium" | "high" | "critical"
    metadata?: Record<string, unknown>
    actorUserId?: string | null
    actorEmail?: string | null
    attemptId?: string | null
  },
): Promise<void> {
  await createDeliveryEvent(admin, {
    provider_id: input.provider_id,
    event_type: input.event_type,
    severity: input.severity ?? "low",
    title: input.title,
    description: input.description,
    metadata: {
      ...(input.metadata ?? {}),
      delivery_attempt_id: input.attemptId ?? null,
      actor_user_id: input.actorUserId ?? null,
      actor_email: input.actorEmail ?? null,
    },
  })

  await appendTransportTimelineEvent(admin, {
    eventType: input.event_type,
    title: input.title,
    summary: input.description,
    providerId: input.provider_id,
    attemptId: input.attemptId ?? null,
    payload: input.metadata,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
  })
}
