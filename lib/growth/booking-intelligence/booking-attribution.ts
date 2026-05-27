import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthBookingAttributionEvent } from "@/lib/growth/booking-intelligence/booking-types"
import { maskBookingLeadLabel } from "@/lib/growth/booking-intelligence/booking-types"

type Row = Record<string, unknown>

function attributionTable(admin: SupabaseClient) {
  return admin.schema("growth").from("booking_attribution_events")
}

export async function recordBookingAttributionEvent(
  admin: SupabaseClient,
  input: {
    leadId: string
    recommendationId?: string | null
    intentSignalId?: string | null
    eventType: string
    attributionSource?: string
    sequenceEnrollmentId?: string | null
    weightedScore?: number
    metadata?: Record<string, unknown>
  },
): Promise<GrowthBookingAttributionEvent> {
  const { data, error } = await attributionTable(admin)
    .insert({
      lead_id: input.leadId,
      recommendation_id: input.recommendationId ?? null,
      intent_signal_id: input.intentSignalId ?? null,
      event_type: input.eventType,
      attribution_source: input.attributionSource ?? "booking_intelligence",
      sequence_enrollment_id: input.sequenceEnrollmentId ?? null,
      weighted_score: input.weightedScore ?? 0,
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
    leadLabel: maskBookingLeadLabel(input.leadId, (leadRow as Row | null)?.company_name as string | null),
    recommendationId: row.recommendation_id ? String(row.recommendation_id) : null,
    intentSignalId: row.intent_signal_id ? String(row.intent_signal_id) : null,
    eventType: String(row.event_type),
    attributionSource: String(row.attribution_source),
    sequenceEnrollmentId: row.sequence_enrollment_id ? String(row.sequence_enrollment_id) : null,
    weightedScore: Number(row.weighted_score ?? 0),
    occurredAt: String(row.occurred_at),
  }
}

export async function listBookingAttributionEvents(
  admin: SupabaseClient,
  input?: { leadId?: string; limit?: number },
): Promise<GrowthBookingAttributionEvent[]> {
  let query = attributionTable(admin).select("*").order("occurred_at", { ascending: false }).limit(input?.limit ?? 50)
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
      labels.set(leadId, maskBookingLeadLabel(leadId, (leadRow as Row | null)?.company_name as string | null))
    }
  }

  return rows.map((row) => {
    const record = row as Row
    const leadId = String(record.lead_id)
    return {
      id: String(record.id),
      leadId,
      leadLabel: labels.get(leadId) ?? "Account",
      recommendationId: record.recommendation_id ? String(record.recommendation_id) : null,
      intentSignalId: record.intent_signal_id ? String(record.intent_signal_id) : null,
      eventType: String(record.event_type),
      attributionSource: String(record.attribution_source),
      sequenceEnrollmentId: record.sequence_enrollment_id ? String(record.sequence_enrollment_id) : null,
      weightedScore: Number(record.weighted_score ?? 0),
      occurredAt: String(record.occurred_at),
    }
  })
}
