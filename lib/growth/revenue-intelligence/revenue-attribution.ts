import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthRevenueAttributionEvent,
  GrowthRevenueAttributionEventType,
  GrowthRevenueAttributionType,
} from "@/lib/growth/revenue-intelligence/revenue-intelligence-types"
import {
  insertPerformanceIntelligenceEvent,
  recordPerformancePlatformTimeline,
} from "@/lib/growth/revenue-intelligence/performance-events"
import { recordAttributionTouchFromRevenueEvent } from "@/lib/growth/revenue-attribution/attribution-revenue-event-bridge"
import { upsertSequencePerformanceSnapshot } from "@/lib/growth/revenue-intelligence/performance-snapshots"

type Row = Record<string, unknown>

function attributionTable(admin: SupabaseClient) {
  return admin.schema("growth").from("revenue_attribution_events")
}

function mapAttribution(row: Row): GrowthRevenueAttributionEvent {
  return {
    id: String(row.id),
    leadId: String(row.lead_id),
    opportunityId: row.opportunity_id ? String(row.opportunity_id) : null,
    eventType: String(row.event_type) as GrowthRevenueAttributionEventType,
    attributionType: String(row.attribution_type) as GrowthRevenueAttributionType,
    sequenceId: row.sequence_id ? String(row.sequence_id) : null,
    sequenceEnrollmentId: row.sequence_enrollment_id ? String(row.sequence_enrollment_id) : null,
    experimentId: row.experiment_id ? String(row.experiment_id) : null,
    variantId: row.variant_id ? String(row.variant_id) : null,
    senderAccountId: row.sender_account_id ? String(row.sender_account_id) : null,
    providerId: row.provider_id ? String(row.provider_id) : null,
    deliveryAttemptId: row.delivery_attempt_id ? String(row.delivery_attempt_id) : null,
    weightedAmount: Number(row.weighted_amount ?? 0),
    revenueAmount: Number(row.revenue_amount ?? 0),
    attributionWeight: Number(row.attribution_weight ?? 1),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    occurredAt: String(row.occurred_at),
  }
}

export async function recordRevenueAttributionEvent(
  admin: SupabaseClient,
  input: {
    leadId: string
    eventType: GrowthRevenueAttributionEventType
    attributionType?: GrowthRevenueAttributionType
    opportunityId?: string | null
    sequenceId?: string | null
    sequenceEnrollmentId?: string | null
    experimentId?: string | null
    variantId?: string | null
    senderAccountId?: string | null
    providerId?: string | null
    deliveryAttemptId?: string | null
    weightedAmount?: number
    revenueAmount?: number
    attributionWeight?: number
    metadata?: Record<string, unknown>
    occurredAt?: string
  },
): Promise<GrowthRevenueAttributionEvent> {
  const { data, error } = await attributionTable(admin)
    .insert({
      lead_id: input.leadId,
      opportunity_id: input.opportunityId ?? null,
      event_type: input.eventType,
      attribution_type: input.attributionType ?? "sequence",
      sequence_id: input.sequenceId ?? null,
      sequence_enrollment_id: input.sequenceEnrollmentId ?? null,
      experiment_id: input.experimentId ?? null,
      variant_id: input.variantId ?? null,
      sender_account_id: input.senderAccountId ?? null,
      provider_id: input.providerId ?? null,
      delivery_attempt_id: input.deliveryAttemptId ?? null,
      weighted_amount: input.weightedAmount ?? 0,
      revenue_amount: input.revenueAmount ?? 0,
      attribution_weight: input.attributionWeight ?? 1,
      metadata: input.metadata ?? {},
      occurred_at: input.occurredAt ?? new Date().toISOString(),
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  const delta: Record<string, number> = {}
  if (input.eventType === "meeting_booked") delta.meetings = 1
  if (input.eventType === "opportunity_created") {
    delta.opportunities = 1
    delta.pipeline_value = input.weightedAmount ?? 0
  }
  if (input.eventType === "opportunity_won") {
    delta.wins = 1
    delta.revenue = input.revenueAmount ?? 0
  }
  if (input.eventType === "pipeline_value") delta.pipeline_value = input.weightedAmount ?? 0

  await upsertSequencePerformanceSnapshot(admin, {
    sequenceId: input.sequenceId ?? null,
    sequenceEnrollmentId: input.sequenceEnrollmentId ?? null,
    delta,
    metadata: { attribution_event_type: input.eventType },
  }).catch(() => undefined)

  await insertPerformanceIntelligenceEvent(admin, {
    eventType: "attribution_recorded",
    title: "Revenue attribution recorded",
    description: `${input.eventType.replace(/_/g, " ")} attributed to ${input.attributionType ?? "sequence"}.`,
    entityType: input.attributionType ?? "sequence",
    entityId: input.sequenceId ?? input.leadId,
    metadata: { event_type: input.eventType, weighted_amount: input.weightedAmount ?? 0 },
  }).catch(() => undefined)

  await recordPerformancePlatformTimeline(admin, {
    eventType: "revenue_attribution_recorded",
    title: "Revenue attribution recorded",
    summary: input.eventType,
    payload: { lead_id: input.leadId, event_type: input.eventType },
  }).catch(() => undefined)

  const mapped = mapAttribution(data as Row)
  await recordAttributionTouchFromRevenueEvent(admin, {
    revenueEventId: mapped.id,
    leadId: input.leadId,
    eventType: input.eventType,
    opportunityId: input.opportunityId,
    sequenceId: input.sequenceId,
    sequenceEnrollmentId: input.sequenceEnrollmentId,
    senderAccountId: input.senderAccountId,
    deliveryAttemptId: input.deliveryAttemptId,
    attributionSource: input.metadata?.source ? String(input.metadata.source) : "revenue_attribution_events",
    attributionConfidence: input.attributionWeight ?? 1,
    metadata: input.metadata,
    occurredAt: mapped.occurredAt,
  })

  return mapped
}

export async function listRevenueAttributionEvents(
  admin: SupabaseClient,
  input?: { limit?: number; leadId?: string },
): Promise<GrowthRevenueAttributionEvent[]> {
  let query = attributionTable(admin).select("*").order("occurred_at", { ascending: false }).limit(input?.limit ?? 50)
  if (input?.leadId) query = query.eq("lead_id", input.leadId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapAttribution(row as Row))
}

export async function resolveAttributionContextFromDeliveryAttempt(
  admin: SupabaseClient,
  deliveryAttemptId: string,
): Promise<{
  leadId: string | null
  sequenceEnrollmentId: string | null
  sequenceId: string | null
  experimentId: string | null
  variantId: string | null
  senderAccountId: string | null
  providerId: string | null
}> {
  const { data } = await admin
    .schema("growth")
    .from("delivery_attempts")
    .select("lead_id, sender_account_id, provider_id, sequence_enrollment_id, metadata")
    .eq("id", deliveryAttemptId)
    .maybeSingle()
  if (!data) {
    return {
      leadId: null,
      sequenceEnrollmentId: null,
      sequenceId: null,
      experimentId: null,
      variantId: null,
      senderAccountId: null,
      providerId: null,
    }
  }
  const row = data as Row
  const metadata = row.metadata as Row | null
  let sequenceId: string | null = null
  const enrollmentId = row.sequence_enrollment_id ? String(row.sequence_enrollment_id) : null
  if (enrollmentId) {
    const { data: enrollment } = await admin
      .schema("growth")
      .from("sequence_enrollments")
      .select("sequence_pattern_id")
      .eq("id", enrollmentId)
      .maybeSingle()
    sequenceId = enrollment?.sequence_pattern_id ? String(enrollment.sequence_pattern_id) : null
  }
  return {
    leadId: row.lead_id ? String(row.lead_id) : null,
    sequenceEnrollmentId: enrollmentId,
    sequenceId,
    experimentId: metadata?.experiment_id ? String(metadata.experiment_id) : null,
    variantId: metadata?.experiment_variant_id ? String(metadata.experiment_variant_id) : null,
    senderAccountId: row.sender_account_id ? String(row.sender_account_id) : null,
    providerId: row.provider_id ? String(row.provider_id) : null,
  }
}

export async function recordMeetingAttributionForLead(
  admin: SupabaseClient,
  input: { leadId: string; deliveryAttemptId?: string | null; metadata?: Record<string, unknown> },
): Promise<void> {
  let context = {
    sequenceEnrollmentId: null as string | null,
    sequenceId: null as string | null,
    experimentId: null as string | null,
    variantId: null as string | null,
    senderAccountId: null as string | null,
    providerId: null as string | null,
  }
  if (input.deliveryAttemptId) {
    const resolved = await resolveAttributionContextFromDeliveryAttempt(admin, input.deliveryAttemptId)
    context = {
      sequenceEnrollmentId: resolved.sequenceEnrollmentId,
      sequenceId: resolved.sequenceId,
      experimentId: resolved.experimentId,
      variantId: resolved.variantId,
      senderAccountId: resolved.senderAccountId,
      providerId: resolved.providerId,
    }
  }

  await recordRevenueAttributionEvent(admin, {
    leadId: input.leadId,
    eventType: "meeting_booked",
    attributionType: context.variantId ? "variant" : context.sequenceId ? "sequence" : "sequence",
    sequenceId: context.sequenceId,
    sequenceEnrollmentId: context.sequenceEnrollmentId,
    experimentId: context.experimentId,
    variantId: context.variantId,
    senderAccountId: context.senderAccountId,
    providerId: context.providerId,
    deliveryAttemptId: input.deliveryAttemptId ?? null,
    attributionWeight: context.variantId ? 0.6 : 0.4,
    metadata: input.metadata ?? {},
  }).catch(() => undefined)
}

export async function recordReplyDraftPerformanceAttribution(
  admin: SupabaseClient,
  input: {
    leadId: string
    draftId: string
    deliveryAttemptId?: string | null
    sequenceEnrollmentId?: string | null
  },
): Promise<void> {
  await recordRevenueAttributionEvent(admin, {
    leadId: input.leadId,
    eventType: "pipeline_value",
    attributionType: "reply_draft",
    sequenceEnrollmentId: input.sequenceEnrollmentId ?? null,
    deliveryAttemptId: input.deliveryAttemptId ?? null,
    attributionWeight: 0.25,
    metadata: { reply_draft_id: input.draftId, source: "reply_draft_sent" },
  }).catch(() => undefined)
}
