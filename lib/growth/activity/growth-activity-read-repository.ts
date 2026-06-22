import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_ACTIVITY_UNIFIED_TIMELINE_TYPES } from "@/lib/growth/activity/growth-activity-event-types"
import type { GrowthActivityLeadTimelineRow } from "@/lib/growth/activity/growth-activity-source-adapters"

const MAX_ORG_LEADS = 500
const MAX_TIMELINE_ROWS = 300

export async function loadGrowthActivityLeadTimelineForOrg(
  admin: SupabaseClient,
  input: {
    organizationId: string
    startAt: string
    endAt: string
    limit?: number
  },
): Promise<GrowthActivityLeadTimelineRow[]> {
  const limit = Math.min(input.limit ?? MAX_TIMELINE_ROWS, MAX_TIMELINE_ROWS)

  const { data: leads, error: leadError } = await admin
    .schema("growth")
    .from("leads")
    .select("id, first_name, last_name, company_name")
    .eq("promoted_organization_id", input.organizationId)
    .limit(MAX_ORG_LEADS)

  if (leadError?.message?.includes("does not exist")) return []
  if (leadError || !leads?.length) return []

  const leadMap = new Map<
    string,
    { firstName: string | null; lastName: string | null; companyName: string | null }
  >()
  for (const row of leads) {
    const typed = row as {
      id: string
      first_name: string | null
      last_name: string | null
      company_name: string | null
    }
    leadMap.set(typed.id, {
      firstName: typed.first_name,
      lastName: typed.last_name,
      companyName: typed.company_name,
    })
  }

  const leadIds = [...leadMap.keys()]
  if (leadIds.length === 0) return []

  const { data, error } = await admin
    .schema("growth")
    .from("lead_timeline_events")
    .select("id, lead_id, event_type, title, summary, payload, occurred_at")
    .in("lead_id", leadIds)
    .in("event_type", [...GROWTH_ACTIVITY_UNIFIED_TIMELINE_TYPES])
    .gte("occurred_at", input.startAt)
    .lte("occurred_at", input.endAt)
    .order("occurred_at", { ascending: false })
    .limit(limit)

  if (error?.message?.includes("does not exist")) return []
  if (error) return []

  return (data ?? []).map((row) => {
    const typed = row as {
      id: string
      lead_id: string
      event_type: string
      title: string
      summary: string | null
      payload: Record<string, unknown> | null
      occurred_at: string
    }
    const lead = leadMap.get(typed.lead_id)
    const leadName = lead
      ? [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim() || null
      : null
    return {
      id: typed.id,
      leadId: typed.lead_id,
      leadName,
      companyName: lead?.companyName ?? null,
      eventType: typed.event_type,
      title: typed.title,
      summary: typed.summary,
      occurredAt: typed.occurred_at,
      payload: typed.payload ?? {},
    }
  })
}
