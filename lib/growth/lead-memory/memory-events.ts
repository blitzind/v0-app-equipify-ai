import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export async function appendLeadMemoryTimelineEvent(
  admin: SupabaseClient,
  input: {
    eventType:
      | "lead_memory_recorded"
      | "lead_memory_rebuilt"
      | "relationship_stage_changed"
      | "objection_memory_recorded"
      | "preference_memory_recorded"
      | "committee_context_recorded"
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
