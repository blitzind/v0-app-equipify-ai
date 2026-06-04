import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthRevenueAttributionEventType } from "@/lib/growth/revenue-intelligence/revenue-intelligence-types"
import type { GrowthAttributionTouchType } from "@/lib/growth/revenue-attribution/attribution-touch-types"
import { recordAttributionTouch } from "@/lib/growth/revenue-attribution/record-attribution-touch"

function touchTypeForRevenueEvent(eventType: GrowthRevenueAttributionEventType): GrowthAttributionTouchType | null {
  switch (eventType) {
    case "meeting_booked":
      return "meeting"
    case "opportunity_created":
      return "opportunity_created"
    case "opportunity_won":
      return "opportunity_won"
    case "positive_reply_detected":
    case "demo_request_detected":
    case "pricing_question_detected":
    case "momentum_accelerated":
      return "reply"
    default:
      return null
  }
}

/** Mirror legacy revenue_attribution_events into the touch ledger. */
export async function recordAttributionTouchFromRevenueEvent(
  admin: SupabaseClient,
  input: {
    revenueEventId: string
    leadId: string
    eventType: GrowthRevenueAttributionEventType
    opportunityId?: string | null
    sequenceId?: string | null
    sequenceEnrollmentId?: string | null
    senderAccountId?: string | null
    deliveryAttemptId?: string | null
    attributionSource: string
    attributionConfidence?: number
    metadata?: Record<string, unknown>
    occurredAt?: string
  },
): Promise<void> {
  const touchType = touchTypeForRevenueEvent(input.eventType)
  if (!touchType) return

  const repUserId =
    input.metadata?.rep_user_id != null ? String(input.metadata.rep_user_id) : undefined

  await recordAttributionTouch(admin, {
    touchType,
    leadId: input.leadId,
    touchedAt: input.occurredAt,
    opportunityId: input.opportunityId,
    sequenceId: input.sequenceId,
    sequenceEnrollmentId: input.sequenceEnrollmentId,
    senderAccountId: input.senderAccountId,
    repUserId,
    deliveryAttemptId: input.deliveryAttemptId,
    revenueAttributionEventId: input.revenueEventId,
    attributionSource: input.attributionSource,
    attributionConfidence: input.attributionConfidence,
    metadata: { ...input.metadata, revenue_event_type: input.eventType },
    resolveContext: true,
  }).catch(() => undefined)
}
