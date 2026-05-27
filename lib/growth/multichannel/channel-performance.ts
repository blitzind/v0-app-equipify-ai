import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  channelAttributionWeight,
  maskMultichannelLeadLabel,
  type GrowthChannelPerformanceSnapshot,
  type GrowthSequenceChannelType,
} from "@/lib/growth/multichannel/multichannel-types"

type Row = Record<string, unknown>

function snapshotsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("channel_performance_snapshots")
}

export async function recordChannelPerformanceSnapshot(
  admin: SupabaseClient,
  input: {
    leadId: string
    taskId?: string | null
    channel: GrowthSequenceChannelType
    metricType?: string
    metricValue?: number
    metadata?: Record<string, unknown>
  },
): Promise<GrowthChannelPerformanceSnapshot> {
  const weight = channelAttributionWeight(input.channel)
  const { data, error } = await snapshotsTable(admin)
    .insert({
      lead_id: input.leadId,
      task_id: input.taskId ?? null,
      channel: input.channel,
      metric_type: input.metricType ?? "task_completed",
      metric_value: input.metricValue ?? 1,
      attribution_weight: weight,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  const row = data as Row
  const { data: leadRow } = await admin
    .schema("growth")
    .from("leads")
    .select("company_name")
    .eq("id", input.leadId)
    .maybeSingle()

  return {
    id: String(row.id),
    leadId: input.leadId,
    leadLabel: maskMultichannelLeadLabel(input.leadId, (leadRow as Row | null)?.company_name as string | null),
    taskId: input.taskId ?? null,
    channel: input.channel,
    metricType: String(row.metric_type),
    metricValue: Number(row.metric_value ?? 1),
    attributionWeight: Number(row.attribution_weight ?? weight),
    recordedAt: String(row.recorded_at),
  }
}

export async function listChannelPerformanceSnapshots(
  admin: SupabaseClient,
  input?: { leadId?: string; limit?: number },
): Promise<GrowthChannelPerformanceSnapshot[]> {
  let query = snapshotsTable(admin).select("*").order("recorded_at", { ascending: false }).limit(input?.limit ?? 50)
  if (input?.leadId) query = query.eq("lead_id", input.leadId)
  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = data ?? []
  const labels = new Map<string, string>()
  for (const row of rows) {
    const leadId = String((row as Row).lead_id)
    if (!labels.has(leadId)) {
      const { data: leadRow } = await admin
        .schema("growth")
        .from("leads")
        .select("company_name")
        .eq("id", leadId)
        .maybeSingle()
      labels.set(leadId, maskMultichannelLeadLabel(leadId, (leadRow as Row | null)?.company_name as string | null))
    }
  }

  return rows.map((row) => {
    const record = row as Row
    const leadId = String(record.lead_id)
    return {
      id: String(record.id),
      leadId,
      leadLabel: labels.get(leadId) ?? "Account",
      taskId: record.task_id ? String(record.task_id) : null,
      channel: String(record.channel) as GrowthChannelPerformanceSnapshot["channel"],
      metricType: String(record.metric_type),
      metricValue: Number(record.metric_value ?? 0),
      attributionWeight: Number(record.attribution_weight ?? 0),
      recordedAt: String(record.recorded_at),
    }
  })
}
