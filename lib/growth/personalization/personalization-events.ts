import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export async function appendPersonalizationTimelineEvent(
  admin: SupabaseClient,
  input: {
    eventType: string
    title: string
    summary: string
    leadId?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  await admin
    .schema("growth")
    .from("platform_timeline_events")
    .insert({
      event_type: input.eventType,
      title: input.title,
      summary: input.summary,
      metadata: { lead_id: input.leadId ?? null, ...(input.metadata ?? {}) },
    })
    .then(() => undefined)
    .catch(() => undefined)
}
