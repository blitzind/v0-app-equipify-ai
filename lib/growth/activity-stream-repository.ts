import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthLeadActivityStreamItem } from "@/lib/growth/engagement-types"
import { listGrowthLeadTimelineEvents } from "@/lib/growth/timeline-repository"

const TIMELINE_KINDS = new Set([
  "manual_touch",
  "follow_up_completed",
  "interested",
  "call_started",
  "call_attempted",
  "voicemail_left",
  "decision_maker_confirmed",
  "decision_maker_added",
  "research_completed",
  "email_opened",
  "email_clicked",
  "email_replied",
  "email_bounced",
  "email_unsubscribed",
])

export async function listGrowthLeadActivityStream(
  admin: SupabaseClient,
  leadId: string,
  limit = 50,
): Promise<GrowthLeadActivityStreamItem[]> {
  const timeline = await listGrowthLeadTimelineEvents(admin, { leadId, limit })
  const items: GrowthLeadActivityStreamItem[] = timeline
    .filter((event) => TIMELINE_KINDS.has(event.eventType))
    .map((event) => ({
      id: event.id,
      kind: event.eventType,
      title: event.title,
      summary: event.summary,
      occurredAt: event.occurredAt,
      source: event.eventType.startsWith("email_") ? "email" : "timeline",
    }))

  const { data: callEvents, error } = await admin
    .schema("growth")
    .from("lead_call_events")
    .select("id, disposition, note, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  for (const row of callEvents ?? []) {
    items.push({
      id: row.id as string,
      kind: `call_${row.disposition}`,
      title: "Call logged",
      summary: (row.note as string | null) ?? String(row.disposition),
      occurredAt: row.created_at as string,
      source: "call",
    })
  }

  items.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
  return items.slice(0, limit)
}
