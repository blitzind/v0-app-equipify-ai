import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { ProspectSearchLeadRelationshipHydration } from "@/lib/growth/prospect-search/prospect-search-relationship-memory"

export type { ProspectSearchLeadRelationshipHydration }

export async function loadProspectSearchLeadRelationshipHydrationBatch(
  admin: SupabaseClient,
  leadIds: string[],
): Promise<Map<string, ProspectSearchLeadRelationshipHydration>> {
  const map = new Map<string, ProspectSearchLeadRelationshipHydration>()
  const unique = [...new Set(leadIds.filter(Boolean))]
  if (unique.length === 0) return map

  const { data: leadRows } = await admin
    .schema("growth")
    .from("leads")
    .select(
      "id, status, last_human_touch_at, last_call_at, connected_call_count, call_attempt_count, engagement_score",
    )
    .in("id", unique)

  for (const row of leadRows ?? []) {
    const record = row as Record<string, unknown>
    const id = typeof record.id === "string" ? record.id : ""
    if (!id) continue
    map.set(id, {
      growth_lead_id: id,
      lead_touch: {
        last_human_touch_at: (record.last_human_touch_at as string | null) ?? null,
        last_call_at: (record.last_call_at as string | null) ?? null,
        connected_call_count: Number(record.connected_call_count ?? 0),
        call_attempt_count: Number(record.call_attempt_count ?? 0),
        engagement_score:
          record.engagement_score != null ? Number(record.engagement_score) : null,
        status: typeof record.status === "string" ? record.status : null,
      },
      relationship_context: null,
      lead_timeline_events: [],
    })
  }

  const { data: contextRows } = await admin
    .schema("growth")
    .from("relationship_context")
    .select("lead_id, progression_score, engagement_trend, relationship_stage")
    .in("lead_id", unique)

  for (const row of contextRows ?? []) {
    const record = row as Record<string, unknown>
    const leadId = typeof record.lead_id === "string" ? record.lead_id : ""
    const existing = map.get(leadId)
    if (!existing) continue
    existing.relationship_context = {
      progression_score:
        record.progression_score != null ? Number(record.progression_score) : null,
      engagement_trend:
        typeof record.engagement_trend === "string" ? record.engagement_trend : null,
      relationship_stage:
        typeof record.relationship_stage === "string" ? record.relationship_stage : null,
    }
  }

  const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
  const { data: timelineRows } = await admin
    .schema("growth")
    .from("lead_timeline_events")
    .select("id, lead_id, event_type, title, summary, occurred_at")
    .in("lead_id", unique)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(Math.min(unique.length * 25, 200))

  for (const row of timelineRows ?? []) {
    const record = row as Record<string, unknown>
    const leadId = typeof record.lead_id === "string" ? record.lead_id : ""
    const existing = map.get(leadId)
    if (!existing) continue
    existing.lead_timeline_events.push({
      id: String(record.id),
      event_type: String(record.event_type),
      title: String(record.title ?? "Timeline event"),
      summary: typeof record.summary === "string" ? record.summary : null,
      occurred_at: String(record.occurred_at),
    })
  }

  return map
}
