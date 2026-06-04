import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthAttributionTouch } from "@/lib/growth/revenue-attribution/attribution-touch-types"
import type { GrowthRevenueAttributionDashboardFilters } from "@/lib/growth/revenue-attribution/revenue-attribution-dashboard-types"

type TouchRow = Record<string, unknown>

function mapTouchRow(row: TouchRow): GrowthAttributionTouch {
  return {
    id: String(row.id),
    touchType: String(row.touch_type) as GrowthAttributionTouch["touchType"],
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

export async function listAttributionTouchesInRange(
  admin: SupabaseClient,
  filters: GrowthRevenueAttributionDashboardFilters,
): Promise<GrowthAttributionTouch[]> {
  let query = admin
    .schema("growth")
    .from("attribution_touches")
    .select("*")
    .gte("touched_at", filters.dateFrom)
    .lte("touched_at", filters.dateTo)
    .order("touched_at", { ascending: true })
    .limit(5000)

  if (filters.channel) query = query.eq("channel", filters.channel)
  if (filters.repUserId) query = query.eq("rep_user_id", filters.repUserId)
  if (filters.sequenceId) query = query.eq("sequence_id", filters.sequenceId)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapTouchRow(row as TouchRow))
}

export type OpportunityRow = {
  id: string
  leadId: string
  amount: number
  closedWonAt: string | null
  closedLostAt: string | null
  ownerUserId: string | null
  createdAt: string
}

export async function listOpportunitiesForAttributionDashboard(
  admin: SupabaseClient,
): Promise<OpportunityRow[]> {
  const { data, error } = await admin
    .schema("growth")
    .from("opportunities")
    .select("id, lead_id, amount, closed_won_at, closed_lost_at, owner_user_id, created_at")
    .limit(2000)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    return {
      id: String(r.id),
      leadId: String(r.lead_id),
      amount: Number(r.amount ?? 0),
      closedWonAt: r.closed_won_at ? String(r.closed_won_at) : null,
      closedLostAt: r.closed_lost_at ? String(r.closed_lost_at) : null,
      ownerUserId: r.owner_user_id ? String(r.owner_user_id) : null,
      createdAt: String(r.created_at),
    }
  })
}

export type AttributionPathRow = {
  id: string
  leadId: string
  opportunityId: string | null
  pathScope: string
  touchIds: string[]
  firstTouchId: string | null
  lastTouchId: string | null
  pathSummary: Record<string, unknown>
}

export async function listAttributionPathsForLeads(
  admin: SupabaseClient,
  leadIds: string[],
): Promise<AttributionPathRow[]> {
  if (leadIds.length === 0) return []
  const { data, error } = await admin
    .schema("growth")
    .from("attribution_paths")
    .select("id, lead_id, opportunity_id, path_scope, touch_ids, first_touch_id, last_touch_id, path_summary")
    .in("lead_id", leadIds.slice(0, 200))
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    return {
      id: String(r.id),
      leadId: String(r.lead_id),
      opportunityId: r.opportunity_id ? String(r.opportunity_id) : null,
      pathScope: String(r.path_scope),
      touchIds: Array.isArray(r.touch_ids) ? (r.touch_ids as string[]) : [],
      firstTouchId: r.first_touch_id ? String(r.first_touch_id) : null,
      lastTouchId: r.last_touch_id ? String(r.last_touch_id) : null,
      pathSummary: (r.path_summary as Record<string, unknown>) ?? {},
    }
  })
}

export async function listAttributionTouchesByIds(
  admin: SupabaseClient,
  touchIds: string[],
): Promise<GrowthAttributionTouch[]> {
  if (touchIds.length === 0) return []
  const { data, error } = await admin
    .schema("growth")
    .from("attribution_touches")
    .select("*")
    .in("id", touchIds.slice(0, 500))
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapTouchRow(row as TouchRow))
}

export type LeadAttributionContext = {
  id: string
  sourceChannel: string | null
  sourceKind: string | null
  sourceCampaign: string | null
  industry: string | null
}

export async function loadLeadAttributionContexts(
  admin: SupabaseClient,
  leadIds: string[],
): Promise<Map<string, LeadAttributionContext>> {
  const map = new Map<string, LeadAttributionContext>()
  if (leadIds.length === 0) return map

  const { data, error } = await admin
    .schema("growth")
    .from("leads")
    .select("id, source_channel, source_kind, source_campaign, metadata")
    .in("id", leadIds.slice(0, 200))
  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    const r = row as Record<string, unknown>
    const metadata = (r.metadata as Record<string, unknown> | null) ?? {}
    const industry =
      typeof metadata.industry === "string" && metadata.industry.trim()
        ? metadata.industry.trim()
        : typeof metadata.vertical === "string" && metadata.vertical.trim()
          ? metadata.vertical.trim()
          : null
    map.set(String(r.id), {
      id: String(r.id),
      sourceChannel: r.source_channel ? String(r.source_channel) : null,
      sourceKind: r.source_kind ? String(r.source_kind) : null,
      sourceCampaign: r.source_campaign ? String(r.source_campaign) : null,
      industry,
    })
  }
  return map
}

export async function loadSequenceLabels(admin: SupabaseClient): Promise<Map<string, string>> {
  const { data } = await admin.schema("growth").from("sequence_patterns").select("id, name").limit(500)
  const map = new Map<string, string>()
  for (const row of data ?? []) {
    map.set(String((row as { id: string }).id), String((row as { name?: string }).name ?? "Sequence"))
  }
  return map
}

export async function loadSequenceStepLabels(admin: SupabaseClient): Promise<Map<string, string>> {
  const { data } = await admin
    .schema("growth")
    .from("sequence_pattern_steps")
    .select("id, step_order, channel")
    .limit(2000)
  const map = new Map<string, string>()
  for (const row of data ?? []) {
    const r = row as { id: string; step_order?: number; channel?: string }
    map.set(String(r.id), `Step ${r.step_order ?? "?"} · ${r.channel ?? "email"}`)
  }
  return map
}

export async function loadSenderLabels(admin: SupabaseClient): Promise<Map<string, string>> {
  const { data } = await admin
    .schema("growth")
    .from("sender_accounts")
    .select("id, email_address, display_name")
    .is("deleted_at", null)
    .limit(500)
  const map = new Map<string, string>()
  for (const row of data ?? []) {
    const r = row as { id: string; email_address?: string; display_name?: string }
    const label = (r.display_name ?? r.email_address ?? "Sender").trim()
    map.set(String(r.id), label)
  }
  return map
}
