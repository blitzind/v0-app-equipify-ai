import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthInboxOwnershipTimelineEventType } from "@/lib/growth/inbox-team-ownership/inbox-team-ownership-types"

function platformTimelineTable(admin: SupabaseClient) {
  return admin.schema("growth").from("platform_timeline_events")
}

export async function recordInboxOwnershipPlatformTimeline(
  admin: SupabaseClient,
  input: {
    eventType: GrowthInboxOwnershipTimelineEventType | "thread_owner_assigned"
    title: string
    summary?: string
    leadId?: string | null
    threadId?: string | null
    payload?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await platformTimelineTable(admin).insert({
    connection_id: null,
    event_type: input.eventType,
    title: input.title.slice(0, 200),
    summary: input.summary?.slice(0, 500) ?? null,
    payload: {
      ...(input.payload ?? {}),
      lead_id: input.leadId ?? null,
      thread_id: input.threadId ?? null,
      source: "growth_inbox_team_ownership",
    },
  })
  if (error) throw new Error(error.message)
}
