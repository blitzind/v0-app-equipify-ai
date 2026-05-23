import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

/** Sets first_human_touch_at and time_to_first_touch_hours once; always updates last_human_touch_at. */
export async function recordGrowthLeadHumanTouch(
  admin: SupabaseClient,
  leadId: string,
  touchedAt: string = new Date().toISOString(),
): Promise<void> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return

  const patch: Record<string, unknown> = {
    last_human_touch_at: touchedAt,
  }

  if (!lead.firstHumanTouchAt) {
    const created = new Date(lead.createdAt)
    const touch = new Date(touchedAt)
    const hours = Number.isNaN(created.getTime())
      ? null
      : Math.max(0, Math.round(((touch.getTime() - created.getTime()) / (60 * 60 * 1000)) * 100) / 100)

    patch.first_human_touch_at = touchedAt
    patch.time_to_first_touch_hours = hours
  }

  await growthLeadsTable(admin).update(patch).eq("id", leadId)
}
