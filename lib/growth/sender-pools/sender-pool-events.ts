import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export async function appendSenderPoolTimelineEvent(
  admin: SupabaseClient,
  input: {
    eventType:
      | "sender_pool_created"
      | "sender_pool_rotated"
      | "sender_fatigue_detected"
      | "sender_pool_member_cooldown"
    title: string
    summary: string
    leadId?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  try {
    await admin.schema("growth").from("platform_timeline_events").insert({
      event_type: input.eventType,
      title: input.title.slice(0, 200),
      summary: input.summary.slice(0, 1000),
      lead_id: input.leadId ?? null,
      metadata: input.metadata ?? {},
    })
  } catch {
    /* best-effort */
  }
}
