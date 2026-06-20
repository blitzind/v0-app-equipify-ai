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
import { isTerminalEnrollmentWaitStatus } from "@/lib/growth/sequences/conditions/sequence-wait-types"
import { consumeBudget } from "@/lib/growth/runtime-guardrails/growth-runtime-budget-service"
import { isWakeExecutionEnabled } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import {
  buildWakeBatchResult,
  parseWakeCursor,
  planWakeEvaluationBatch,
} from "@/lib/growth/runtime-guardrails/growth-wake-guardrails"
import {
  getWakeBatchState,
  persistWakeBatchState,
} from "@/lib/growth/runtime-guardrails/growth-wake-batch-state-repository"
import { GROWTH_RUNTIME_GUARDRAIL_LIMITS } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

export { GROWTH_SEQUENCE_EVENT_WAKE_QA_MARKER }

async function resolveLeadOrganizationId(
  admin: SupabaseClient,
  leadId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("leads")
    .select("organization_id")
    .eq("id", leadId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? String((data as { organization_id: string }).organization_id) : null
}

export async function processSequenceAttributedWakeEvent(
  admin: SupabaseClient,
  input: SequenceAttributedWakeEvent,
): Promise<SequenceEventWakeResult> {
  const wakeExecutionEnabled = await isWakeExecutionEnabled(admin)
  if (!wakeExecutionEnabled) {
    return {
      scannedWaits: 0,
      resolvedWaits: 0,
      blockedWaits: 0,
      skippedWaits: 0,
      wakeExecutionEnabled: false,
      processedCount: 0,
      remainingCount: 0,
      truncated: false,
    }
  }

  const organizationId = await resolveLeadOrganizationId(admin, input.leadId)
  if (organizationId) {
    const budget = await consumeBudget(admin, {
      organizationId,
      resourceType: "wake_evaluations",
      windowKind: "daily",
      volume: 1,
    })
    if (!budget.allowed) {
      return {
        scannedWaits: 0,
        resolvedWaits: 0,
        blockedWaits: 0,
        skippedWaits: 0,
        wakeExecutionEnabled: true,
        processedCount: 0,
        remainingCount: 0,
        truncated: true,
      }
    }
  }

  const batchState = await getWakeBatchState(admin, "sequence_event_wake")
  const { createdAt: cursorCreatedAt, waitId: cursorWaitId } = parseWakeCursor(batchState.wakeCursor)
  const cursor =
    cursorCreatedAt && cursorWaitId ? `${cursorCreatedAt}|${cursorWaitId}` : batchState.wakeCursor

  const perRunCap = GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_WAKE_EVALUATIONS_PER_RUN
  const fetchedWaits = await listActiveWaitsForWakeEvent(admin, {
    leadId: input.leadId,
    sequenceEnrollmentId: input.sequenceEnrollmentId,
    waitedForSource: input.source,
    waitedForEvent: input.event,
    limit: perRunCap + 1,
    cursor,
  })

  const plan = planWakeEvaluationBatch({
    totalWaits: fetchedWaits.length,
    cursor,
    wakeExecutionEnabled,
  })

  const waits = fetchedWaits.slice(0, plan.effectiveLimit)
  const now = input.occurredAt ?? new Date().toISOString()

  const result: SequenceEventWakeResult = {
    scannedWaits: waits.length,
    resolvedWaits: 0,
    blockedWaits: 0,
    skippedWaits: 0,
    wakeExecutionEnabled: true,
  }

  const { resolveWaitMatched } = await import(
    "@/lib/growth/sequences/conditions/sequence-wait-resolver"
  )

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

  const batchResult = buildWakeBatchResult({
    waits: waits.map((wait) => ({ id: wait.id, createdAt: wait.createdAt })),
    totalAvailable: fetchedWaits.length,
    processedThisRun: waits.length,
    priorCursor: cursor,
  })

  await persistWakeBatchState(admin, {
    processorKey: "sequence_event_wake",
    wakeCursor: batchResult.wakeCursor,
    processedCount: batchState.processedCount + batchResult.processedCount,
    remainingCount: batchResult.remainingCount,
  })

  result.wakeCursor = batchResult.wakeCursor
  result.processedCount = batchResult.processedCount
  result.remainingCount = batchResult.remainingCount
  result.truncated = batchResult.truncated

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
