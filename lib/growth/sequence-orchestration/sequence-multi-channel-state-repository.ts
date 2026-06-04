import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthSequenceChannelEventKind,
  GrowthSequenceEnrollmentChannelEvent,
} from "@/lib/growth/sequence-orchestration/sequence-multi-channel-state-types"

type ChannelEventRow = {
  id: string
  enrollment_id: string
  enrollment_step_id: string | null
  lead_id: string
  channel: string
  event_kind: string
  title: string
  summary: string | null
  occurred_at: string
  metadata: Record<string, unknown>
}

function mapRow(row: ChannelEventRow): GrowthSequenceEnrollmentChannelEvent {
  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    enrollmentStepId: row.enrollment_step_id,
    leadId: row.lead_id,
    channel: row.channel,
    eventKind: row.event_kind as GrowthSequenceChannelEventKind,
    title: row.title,
    summary: row.summary,
    occurredAt: row.occurred_at,
    metadata: row.metadata ?? {},
  }
}

export async function recordSequenceEnrollmentChannelEvent(
  admin: SupabaseClient,
  input: {
    enrollmentId: string
    enrollmentStepId?: string | null
    leadId: string
    channel: string
    eventKind: GrowthSequenceChannelEventKind
    title: string
    summary?: string | null
    metadata?: Record<string, unknown>
    occurredAt?: string
  },
): Promise<GrowthSequenceEnrollmentChannelEvent> {
  const { data, error } = await admin
    .schema("growth")
    .from("sequence_enrollment_channel_events")
    .insert({
      enrollment_id: input.enrollmentId,
      enrollment_step_id: input.enrollmentStepId ?? null,
      lead_id: input.leadId,
      channel: input.channel,
      event_kind: input.eventKind,
      title: input.title.slice(0, 200),
      summary: input.summary?.slice(0, 500) ?? null,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data as ChannelEventRow)
}

export async function listSequenceEnrollmentChannelEvents(
  admin: SupabaseClient,
  input: { enrollmentId?: string; leadId?: string; limit?: number },
): Promise<GrowthSequenceEnrollmentChannelEvent[]> {
  let query = admin
    .schema("growth")
    .from("sequence_enrollment_channel_events")
    .select("*")
    .order("occurred_at", { ascending: true })
    .limit(input.limit ?? 100)

  if (input.enrollmentId) query = query.eq("enrollment_id", input.enrollmentId)
  if (input.leadId) query = query.eq("lead_id", input.leadId)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapRow(row as ChannelEventRow))
}
