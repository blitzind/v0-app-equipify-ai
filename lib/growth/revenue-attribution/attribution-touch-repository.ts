import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthAttributionTouch,
  GrowthAttributionTouchType,
} from "@/lib/growth/revenue-attribution/attribution-touch-types"

type Row = Record<string, unknown>

function mapTouch(row: Row): GrowthAttributionTouch {
  return {
    id: String(row.id),
    touchType: String(row.touch_type) as GrowthAttributionTouchType,
    touchedAt: String(row.touched_at),
    leadId: String(row.lead_id),
    opportunityId: row.opportunity_id ? String(row.opportunity_id) : null,
    channel: row.channel ? String(row.channel) : null,
    sequenceId: row.sequence_id ? String(row.sequence_id) : null,
    sequenceStepId: row.sequence_step_id ? String(row.sequence_step_id) : null,
    sequenceEnrollmentId: row.sequence_enrollment_id ? String(row.sequence_enrollment_id) : null,
    senderAccountId: row.sender_account_id ? String(row.sender_account_id) : null,
    repUserId: row.rep_user_id ? String(row.rep_user_id) : null,
    campaignId: row.campaign_id ? String(row.campaign_id) : null,
    deliveryAttemptId: row.delivery_attempt_id ? String(row.delivery_attempt_id) : null,
    revenueAttributionEventId: row.revenue_attribution_event_id
      ? String(row.revenue_attribution_event_id)
      : null,
    attributionSource: String(row.attribution_source ?? "growth_engine"),
    attributionConfidence: Number(row.attribution_confidence ?? 1),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  }
}

export async function insertAttributionTouch(
  admin: SupabaseClient,
  row: Record<string, unknown>,
): Promise<GrowthAttributionTouch> {
  const { data, error } = await admin
    .schema("growth")
    .from("attribution_touches")
    .insert(row)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapTouch(data as Row)
}

export async function listAttributionTouchesForLead(
  admin: SupabaseClient,
  leadId: string,
  options?: { opportunityId?: string | null; limit?: number },
): Promise<GrowthAttributionTouch[]> {
  let query = admin
    .schema("growth")
    .from("attribution_touches")
    .select("*")
    .eq("lead_id", leadId)
    .order("touched_at", { ascending: true })
    .limit(options?.limit ?? 500)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  let rows = (data ?? []).map((r) => mapTouch(r as Row))
  if (options?.opportunityId) {
    rows = rows.filter((t) => !t.opportunityId || t.opportunityId === options.opportunityId)
  }
  return rows
}
