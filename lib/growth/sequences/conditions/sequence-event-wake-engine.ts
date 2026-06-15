import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchConditionById,
  listActiveWaitsForWakeEvent,
} from "@/lib/growth/sequences/conditions/sequence-condition-repository"
import { evaluateSequenceConditionSpecReadOnly } from "@/lib/growth/sequences/conditions/sequence-condition-evaluator"
import {
  GROWTH_SEQUENCE_EVENT_WAKE_QA_MARKER,
  type SequenceAttributedWakeEvent,
  type SequenceEventWakeResult,
} from "@/lib/growth/sequences/conditions/sequence-event-wake-types"
import { resolveWaitMatched } from "@/lib/growth/sequences/conditions/sequence-wait-resolver"
import { isTerminalEnrollmentWaitStatus } from "@/lib/growth/sequences/conditions/sequence-wait-types"

export { GROWTH_SEQUENCE_EVENT_WAKE_QA_MARKER }

export async function processSequenceAttributedWakeEvent(
  admin: SupabaseClient,
  input: SequenceAttributedWakeEvent,
): Promise<SequenceEventWakeResult> {
  const now = input.occurredAt ?? new Date().toISOString()
  const waits = await listActiveWaitsForWakeEvent(admin, {
    leadId: input.leadId,
    sequenceEnrollmentId: input.sequenceEnrollmentId,
    waitedForSource: input.source,
    waitedForEvent: input.event,
  })

  const result: SequenceEventWakeResult = {
    scannedWaits: waits.length,
    resolvedWaits: 0,
    blockedWaits: 0,
    skippedWaits: 0,
  }

  for (const wait of waits) {
    if (isTerminalEnrollmentWaitStatus(wait.status)) {
      result.skippedWaits += 1
      continue
    }

    if (wait.conditionId) {
      const condition = await fetchConditionById(admin, wait.conditionId)
      if (!condition) {
        result.skippedWaits += 1
        continue
      }

      const evaluation = await evaluateSequenceConditionSpecReadOnly(admin, {
        enrollmentId: wait.enrollmentId,
        enrollmentStepId: wait.enrollmentStepId,
        conditionSpec: condition.spec,
        now,
      })

      if (!evaluation.matched) {
        result.skippedWaits += 1
        continue
      }
    }

    const resolution = await resolveWaitMatched(admin, {
      waitId: wait.id,
      now,
    })

    if (resolution.kind === "branched") {
      result.resolvedWaits += 1
    } else if (resolution.kind === "blocked") {
      result.blockedWaits += 1
    } else {
      result.skippedWaits += 1
    }
  }

  return result
}

export function dispatchSequenceEventWakeSafely(
  admin: SupabaseClient,
  input: SequenceAttributedWakeEvent,
): void {
  void processSequenceAttributedWakeEvent(admin, {
    ...input,
    evidenceRef: input.evidenceRef ?? null,
  }).catch(() => undefined)
}

export function dispatchSequenceWakeForDeliveryAttempt(
  admin: SupabaseClient,
  input: {
    leadId: string
    deliveryAttemptId: string
    source: SequenceAttributedWakeEvent["source"]
    event: SequenceAttributedWakeEvent["event"]
    occurredAt?: string
  },
): void {
  void (async () => {
    const { resolveSequenceAttributionFromDeliveryAttemptId } = await import(
      "@/lib/growth/sequences/attribution/sequence-attribution-resolver"
    )
    const attribution = await resolveSequenceAttributionFromDeliveryAttemptId(
      admin,
      input.deliveryAttemptId,
    )
    await processSequenceAttributedWakeEvent(admin, {
      leadId: input.leadId,
      sequenceEnrollmentId: attribution.sequenceEnrollmentId,
      sequenceEnrollmentStepId: attribution.sequenceEnrollmentStepId,
      source: input.source,
      event: input.event,
      evidenceRef: input.deliveryAttemptId,
      occurredAt: input.occurredAt,
    })
  })().catch(() => undefined)
}

export function dispatchSequenceWakeForLeadEvent(
  admin: SupabaseClient,
  input: {
    leadId: string
    source: SequenceAttributedWakeEvent["source"]
    event: SequenceAttributedWakeEvent["event"]
    occurredAt?: string
  },
): void {
  dispatchSequenceEventWakeSafely(admin, {
    leadId: input.leadId,
    source: input.source,
    event: input.event,
    occurredAt: input.occurredAt,
  })
}

export function dispatchSequenceWakeForSmsAttempt(
  admin: SupabaseClient,
  input: {
    leadId: string
    smsDeliveryAttemptId: string
    event: "sms.delivered" | "sms.failed"
    occurredAt?: string
  },
): void {
  void (async () => {
    const { resolveSequenceAttributionFromSmsDeliveryAttemptId } = await import(
      "@/lib/growth/sequences/attribution/sequence-attribution-resolver"
    )
    const attribution = await resolveSequenceAttributionFromSmsDeliveryAttemptId(
      admin,
      input.smsDeliveryAttemptId,
    )
    await processSequenceAttributedWakeEvent(admin, {
      leadId: input.leadId,
      sequenceEnrollmentId: attribution.sequenceEnrollmentId,
      sequenceEnrollmentStepId: attribution.sequenceEnrollmentStepId,
      source: "sms",
      event: input.event,
      evidenceRef: input.smsDeliveryAttemptId,
      occurredAt: input.occurredAt,
    })
  })().catch(() => undefined)
}
