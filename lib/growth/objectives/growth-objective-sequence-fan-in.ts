/** GE-AUTO-2C/2D — Sequence runtime → objective event fan-in (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveGrowthObjectiveOrganizationId } from "@/lib/growth/objectives/growth-objective-event-context"
import { dispatchGrowthObjectiveSourceEvent } from "@/lib/growth/objectives/growth-objective-event-bridge"

export type GrowthObjectiveSequenceFanInInput = {
  leadId: string
  signalType:
    | "enrollment_created"
    | "step_scheduled"
    | "email_sent"
    | "sms_sent"
    | "voice_sent"
    | "reply_received"
    | "step_completed"
    | "step_failed"
    | "enrollment_completed"
    | "enrollment_failed"
    | "enrollment_paused"
  enrollmentId: string
  sequencePatternId?: string | null
  sequencePatternKey?: string | null
  stepId?: string | null
  deliveryAttemptId?: string | null
  launchRunId?: string | null
  campaignId?: string | null
  occurredAt?: string
  metadata?: Record<string, unknown>
}

export async function fanInGrowthObjectiveSequenceEvent(
  admin: SupabaseClient,
  input: GrowthObjectiveSequenceFanInInput,
): Promise<void> {
  try {
    const organizationId = await resolveGrowthObjectiveOrganizationId(admin, { leadId: input.leadId })
    if (!organizationId) return

    const occurredAt = input.occurredAt ?? new Date().toISOString()
    const idempotencyKey = input.deliveryAttemptId
      ? `sequence:${input.signalType}:${input.deliveryAttemptId}`
      : `sequence:${input.signalType}:${input.enrollmentId}:${input.stepId ?? ""}:${occurredAt}`

    await dispatchGrowthObjectiveSourceEvent(admin, {
      organizationId,
      source: "sequence",
      signalType: input.signalType,
      leadId: input.leadId,
      resourceType: "sequence",
      resourceKey: input.sequencePatternKey ?? input.enrollmentId,
      resourceId: input.sequencePatternId ?? input.enrollmentId,
      occurredAt,
      payload: {
        enrollmentId: input.enrollmentId,
        stepId: input.stepId ?? null,
        sequencePatternId: input.sequencePatternId ?? null,
        launchRunId: input.launchRunId ?? null,
        campaignId: input.campaignId ?? null,
        ...(input.metadata ?? {}),
      },
      idempotencyKey,
    })
  } catch {
    // Best-effort — never fail upstream sequence processing.
  }
}
