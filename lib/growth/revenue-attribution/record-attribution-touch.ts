import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  defaultChannelForTouchType,
  type GrowthAttributionTouch,
  type GrowthAttributionTouchType,
} from "@/lib/growth/revenue-attribution/attribution-touch-types"
import { rebuildAttributionPathsForLead } from "@/lib/growth/revenue-attribution/attribution-path-builder"
import { insertAttributionTouch } from "@/lib/growth/revenue-attribution/attribution-touch-repository"
import { isGrowthAttributionTouchLedgerSchemaReady } from "@/lib/growth/revenue-attribution/attribution-touch-schema-health"
import {
  resolveAttributionContextForLead,
  type ResolvedAttributionContext,
} from "@/lib/growth/revenue-attribution/resolve-attribution-context"

export type RecordAttributionTouchInput = {
  touchType: GrowthAttributionTouchType
  leadId: string
  touchedAt?: string
  opportunityId?: string | null
  channel?: string | null
  sequenceId?: string | null
  sequenceStepId?: string | null
  sequenceEnrollmentId?: string | null
  senderAccountId?: string | null
  repUserId?: string | null
  campaignId?: string | null
  deliveryAttemptId?: string | null
  revenueAttributionEventId?: string | null
  attributionSource: string
  attributionConfidence?: number
  metadata?: Record<string, unknown>
  /** When true, merge missing fields from lead/enrollment/opportunity context. */
  resolveContext?: boolean
  /** Skip path rebuild (batch jobs). */
  skipPathRebuild?: boolean
}

function clampConfidence(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return 1
  return Math.max(0, Math.min(1, value))
}

function mergeContext(
  input: RecordAttributionTouchInput,
  ctx: ResolvedAttributionContext,
): RecordAttributionTouchInput {
  return {
    ...input,
    opportunityId: input.opportunityId ?? ctx.opportunityId,
    sequenceId: input.sequenceId ?? ctx.sequenceId,
    sequenceStepId: input.sequenceStepId ?? ctx.sequenceStepId,
    sequenceEnrollmentId: input.sequenceEnrollmentId ?? ctx.sequenceEnrollmentId,
    senderAccountId: input.senderAccountId ?? ctx.senderAccountId,
    repUserId: input.repUserId ?? ctx.repUserId,
    campaignId: input.campaignId ?? ctx.campaignId,
    deliveryAttemptId: input.deliveryAttemptId ?? ctx.deliveryAttemptId,
  }
}

export async function recordAttributionTouch(
  admin: SupabaseClient,
  input: RecordAttributionTouchInput,
): Promise<GrowthAttributionTouch | null> {
  if (!(await isGrowthAttributionTouchLedgerSchemaReady(admin))) return null

  let merged = input
  if (input.resolveContext !== false) {
    const ctx = await resolveAttributionContextForLead(admin, input.leadId, {
      opportunityId: input.opportunityId,
      sequenceId: input.sequenceId,
      sequenceStepId: input.sequenceStepId,
      sequenceEnrollmentId: input.sequenceEnrollmentId,
      senderAccountId: input.senderAccountId,
      repUserId: input.repUserId,
      campaignId: input.campaignId,
      deliveryAttemptId: input.deliveryAttemptId,
    })
    if (ctx) merged = mergeContext(input, ctx)
  }

  const channel = merged.channel ?? defaultChannelForTouchType(merged.touchType)

  const touch = await insertAttributionTouch(admin, {
    touch_type: merged.touchType,
    touched_at: merged.touchedAt ?? new Date().toISOString(),
    lead_id: merged.leadId,
    opportunity_id: merged.opportunityId ?? null,
    channel,
    sequence_id: merged.sequenceId ?? null,
    sequence_step_id: merged.sequenceStepId ?? null,
    sequence_enrollment_id: merged.sequenceEnrollmentId ?? null,
    sender_account_id: merged.senderAccountId ?? null,
    rep_user_id: merged.repUserId ?? null,
    campaign_id: merged.campaignId ?? null,
    delivery_attempt_id: merged.deliveryAttemptId ?? null,
    revenue_attribution_event_id: merged.revenueAttributionEventId ?? null,
    attribution_source: merged.attributionSource,
    attribution_confidence: clampConfidence(merged.attributionConfidence),
    metadata: merged.metadata ?? {},
  })

  if (!input.skipPathRebuild) {
    await rebuildAttributionPathsForLead(admin, merged.leadId, merged.opportunityId ?? null).catch(() => undefined)
  }

  return touch
}
