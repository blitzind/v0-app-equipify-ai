import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listEdgesFromPatternStep } from "@/lib/growth/sequences/conditions/sequence-condition-repository"
import { listGrowthSequencePatterns } from "@/lib/growth/sequence-pattern-repository"
import {
  GROWTH_SEQUENCE_WAIT_TIMEOUT_QA_MARKER,
  type SequenceWaitRecoveryDiagnostics,
  type SequenceWaitRecoveryIssue,
} from "@/lib/growth/sequences/conditions/sequence-wait-timeout-types"

export { GROWTH_SEQUENCE_WAIT_TIMEOUT_QA_MARKER }

const STUCK_ACTIVE_MS = 7 * 24 * 60 * 60 * 1000

export async function diagnoseSequenceWaitRecovery(
  admin: SupabaseClient,
  input?: { limit?: number },
): Promise<SequenceWaitRecoveryDiagnostics> {
  const limit = input?.limit ?? 100
  const stuckCutoff = new Date(Date.now() - STUCK_ACTIVE_MS).toISOString()

  const { data: activeWaits, error } = await admin
    .schema("growth")
    .from("sequence_enrollment_step_waits")
    .select("id, enrollment_id, enrollment_step_id, pattern_step_id, wait_kind, status, timeout_at, started_at, created_at")
    .in("status", ["pending", "active"])
    .order("created_at", { ascending: true })
    .limit(limit)

  if (error) throw new Error(error.message)

  const stuckWaits: SequenceWaitRecoveryIssue[] = []
  const missingTimeout: SequenceWaitRecoveryIssue[] = []
  const invalidTimeoutTarget: SequenceWaitRecoveryIssue[] = []

  const patterns = await listGrowthSequencePatterns(admin)

  for (const row of activeWaits ?? []) {
    const waitId = String((row as Record<string, unknown>).id)
    const enrollmentId = String((row as Record<string, unknown>).enrollment_id)
    const patternStepId = (row as Record<string, unknown>).pattern_step_id
      ? String((row as Record<string, unknown>).pattern_step_id)
      : null
    const waitKind = String((row as Record<string, unknown>).wait_kind ?? "")
    const timeoutAt = (row as Record<string, unknown>).timeout_at as string | null
    const startedAt = String(
      (row as Record<string, unknown>).started_at ??
        (row as Record<string, unknown>).created_at ??
        "",
    )

    if (!patternStepId) {
      stuckWaits.push({
        waitId,
        enrollmentId,
        issue: "missing_pattern_step",
        detail: "Active wait missing pattern_step_id — cannot resolve branch target.",
      })
      continue
    }

    if (waitKind === "until_event" && !timeoutAt) {
      missingTimeout.push({
        waitId,
        enrollmentId,
        issue: "missing_timeout",
        detail: "Event wait active without timeout_at — may never expire via scheduler.",
      })
    }

    if (startedAt && startedAt < stuckCutoff) {
      stuckWaits.push({
        waitId,
        enrollmentId,
        issue: "stuck_active",
        detail: `Wait active since ${startedAt.slice(0, 10)} without terminal resolution.`,
      })
    }

    const { data: enrollment } = await admin
      .schema("growth")
      .from("sequence_enrollments")
      .select("sequence_pattern_id")
      .eq("id", enrollmentId)
      .maybeSingle()

    const patternId = enrollment?.sequence_pattern_id ? String(enrollment.sequence_pattern_id) : null
    const pattern = patternId ? patterns.find((entry) => entry.id === patternId) : null
    if (!pattern) continue

    const edges = await listEdgesFromPatternStep(admin, pattern.id, patternStepId)
    const timeoutEdge = edges.find((edge) => edge.edgeType === "timeout")
    if (timeoutAt && !timeoutEdge) {
      invalidTimeoutTarget.push({
        waitId,
        enrollmentId,
        issue: "invalid_timeout_target",
        detail: "Wait has timeout_at but no timeout edge configured on pattern step.",
      })
      continue
    }

    if (timeoutEdge) {
      const targetExists = pattern.steps.some((step) => step.id === timeoutEdge.toPatternStepId)
      if (!targetExists) {
        invalidTimeoutTarget.push({
          waitId,
          enrollmentId,
          issue: "invalid_timeout_target",
          detail: `Timeout edge target ${timeoutEdge.toPatternStepId.slice(0, 8)}… not in pattern graph.`,
        })
      }
    }
  }

  return {
    qa_marker: GROWTH_SEQUENCE_WAIT_TIMEOUT_QA_MARKER,
    stuckWaits,
    missingTimeout,
    invalidTimeoutTarget,
    totalIssues: stuckWaits.length + missingTimeout.length + invalidTimeoutTarget.length,
  }
}
