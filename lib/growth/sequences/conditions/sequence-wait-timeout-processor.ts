import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { SequenceEnrollmentWait } from "@/lib/growth/sequences/conditions/sequence-wait-types"
import {
  evaluateSequenceBranchAdvanceGate,
  recordSequenceAdvancementBlockedAudit,
} from "@/lib/growth/sequences/conditions/sequence-branch-advance-gate"
import { fetchGrowthSequenceEnrollmentStepById } from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { resolveWaitTimeout } from "@/lib/growth/sequences/conditions/sequence-wait-resolver"
import {
  GROWTH_SEQUENCE_WAIT_TIMEOUT_QA_MARKER,
  type SequenceWaitTimeoutProcessorResult,
} from "@/lib/growth/sequences/conditions/sequence-wait-timeout-types"
import { isWakeExecutionEnabled } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { GROWTH_RUNTIME_GUARDRAIL_LIMITS } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"
import {
  getWakeBatchState,
  persistWakeBatchState,
} from "@/lib/growth/runtime-guardrails/growth-wake-batch-state-repository"
import { buildWakeBatchResult } from "@/lib/growth/runtime-guardrails/growth-wake-guardrails"

export { GROWTH_SEQUENCE_WAIT_TIMEOUT_QA_MARKER }

const WAIT_SELECT =
  "id, enrollment_id, enrollment_step_id, pattern_step_id, condition_id, wait_kind, status, waited_for_source, waited_for_event, duration_seconds, timeout_at, started_at, resolved_at, resolution_reason, created_at, updated_at"

type WaitRow = {
  id: string
  enrollment_id: string
  enrollment_step_id: string
  pattern_step_id: string | null
  condition_id: string | null
  wait_kind: SequenceEnrollmentWait["waitKind"]
  status: SequenceEnrollmentWait["status"]
  waited_for_source: SequenceEnrollmentWait["waitedForSource"]
  waited_for_event: SequenceEnrollmentWait["waitedForEvent"]
  duration_seconds: number | null
  timeout_at: string | null
  started_at: string | null
  resolved_at: string | null
  resolution_reason: string | null
  created_at: string
  updated_at: string
}

function mapWaitRow(row: WaitRow): SequenceEnrollmentWait {
  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    enrollmentStepId: row.enrollment_step_id,
    patternStepId: row.pattern_step_id,
    conditionId: row.condition_id,
    waitKind: row.wait_kind,
    status: row.status,
    waitedForSource: row.waited_for_source,
    waitedForEvent: row.waited_for_event,
    durationSeconds: row.duration_seconds,
    timeoutAt: row.timeout_at,
    startedAt: row.started_at,
    resolvedAt: row.resolved_at,
    resolutionReason: row.resolution_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listExpiredActiveSequenceWaits(
  admin: SupabaseClient,
  input: { now?: string; limit?: number; cursor?: string | null },
): Promise<SequenceEnrollmentWait[]> {
  const now = input.now ?? new Date().toISOString()
  let query = admin
    .schema("growth")
    .from("sequence_enrollment_step_waits")
    .select(WAIT_SELECT)
    .in("status", ["pending", "active"])
    .not("timeout_at", "is", null)
    .lte("timeout_at", now)
    .order("timeout_at", { ascending: true })
    .limit(input.limit ?? GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_WAKE_EVALUATIONS_PER_RUN)

  if (input.cursor) {
    const [cursorTimeoutAt, cursorWaitId] = input.cursor.split("|")
    if (cursorTimeoutAt && cursorWaitId) {
      query = query.or(
        `timeout_at.gt.${cursorTimeoutAt},and(timeout_at.eq.${cursorTimeoutAt},id.gt.${cursorWaitId})`,
      )
    }
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)
  return ((data ?? []) as WaitRow[]).map(mapWaitRow)
}

function isPauseGateBlockedReason(reason: string): boolean {
  return (
    reason.includes("pause_gate") ||
    reason.includes("enrollment_paused") ||
    reason.includes("enrollment_completed") ||
    reason.includes("enrollment_cancelled") ||
    reason.includes("enrollment_not_active") ||
    reason.includes("exit_candidate")
  )
}

export async function processExpiredSequenceWaits(
  admin: SupabaseClient,
  input?: { now?: string; limit?: number },
): Promise<SequenceWaitTimeoutProcessorResult> {
  const wakeExecutionEnabled = await isWakeExecutionEnabled(admin)
  if (!wakeExecutionEnabled) {
    return {
      scanned: 0,
      resolved: 0,
      blocked: 0,
      failed: 0,
      processedWaitIds: [],
      processedCount: 0,
      remainingCount: 0,
      truncated: false,
    }
  }

  const now = input?.now ?? new Date().toISOString()
  const batchState = await getWakeBatchState(admin, "sequence_wait_timeouts")
  const perRunLimit = input?.limit ?? GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_WAKE_EVALUATIONS_PER_RUN

  const { count: totalExpired } = await admin
    .schema("growth")
    .from("sequence_enrollment_step_waits")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "active"])
    .not("timeout_at", "is", null)
    .lte("timeout_at", now)

  const waits = await listExpiredActiveSequenceWaits(admin, {
    now,
    limit: perRunLimit,
    cursor: batchState.wakeCursor,
  })

  const result: SequenceWaitTimeoutProcessorResult = {
    scanned: waits.length,
    resolved: 0,
    blocked: 0,
    failed: 0,
    processedWaitIds: [],
  }

  for (const wait of waits) {
    try {
      const gate = await evaluateSequenceBranchAdvanceGate(admin, {
        sequenceEnrollmentId: wait.enrollmentId,
      })

      if (gate.blocked) {
        const enrollmentStep = await fetchGrowthSequenceEnrollmentStepById(admin, wait.enrollmentStepId)
        if (enrollmentStep) {
          await recordSequenceAdvancementBlockedAudit(admin, {
            enrollmentId: wait.enrollmentId,
            enrollmentStepId: wait.enrollmentStepId,
            leadId: enrollmentStep.leadId,
            stepOrder: enrollmentStep.stepOrder,
            gate,
            occurredAt: now,
          })
        }
        result.blocked += 1
        result.processedWaitIds.push(wait.id)
        continue
      }

      const resolution = await resolveWaitTimeout(admin, { waitId: wait.id, now })
      result.processedWaitIds.push(wait.id)

      if (resolution.kind === "branched") {
        result.resolved += 1
        continue
      }

      if (resolution.kind === "blocked" && isPauseGateBlockedReason(resolution.reason)) {
        result.blocked += 1
        continue
      }

      result.failed += 1
    } catch {
      result.failed += 1
      result.processedWaitIds.push(wait.id)
    }
  }

  const batchResult = buildWakeBatchResult({
    waits: waits.map((wait) => ({ id: wait.id, createdAt: wait.timeoutAt ?? wait.createdAt })),
    totalAvailable: totalExpired ?? waits.length,
    processedThisRun: waits.length,
    priorCursor: batchState.wakeCursor,
  })

  await persistWakeBatchState(admin, {
    processorKey: "sequence_wait_timeouts",
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
