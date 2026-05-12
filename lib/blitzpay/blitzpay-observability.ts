import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  BLITZPAY_OBSERVABILITY_AUDIT_LIST_CAP,
  BLITZPAY_WORKFLOW_LIST_CAP,
} from "@/lib/blitzpay/blitzpay-workflow-orchestration"

export const BLITZPAY_OBSERVABILITY_EVENT_LIST_CAP = 48
export const BLITZPAY_OBSERVABILITY_IDEMPOTENCY_LIST_CAP = 48
export const BLITZPAY_OBSERVABILITY_REGION_CAP = 8

const SECRET_KEY_RE = /(secret|token|password|api_key|authorization)/i

export type BlitzpayPhase6bReportingSlice = {
  queueHealthScore: number
  workflowFailureRate: number
  idempotencyConflictRate: number
  replayPendingCount: number
  observabilityCoverageRate: number
  workerHealthScore: number
  multiRegionReadinessScore: number
  replayIntegrityScore: number
}

export function sanitizeBlitzpayObservabilityJson(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(input).sort()) {
    if (SECRET_KEY_RE.test(k)) continue
    const v = input[k]
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      out[k] = sanitizeBlitzpayObservabilityJson(v as Record<string, unknown>)
    } else {
      out[k] = v
    }
  }
  return out
}

function clamp01to100(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

/**
 * Deterministic queue health score from snapshot columns (0–100, higher is healthier).
 */
export function deriveQueueHealthScoreFromSnapshot(input: {
  queueDepth: number | null
  failedExecutionCount: number | null
  replayPendingCount: number | null
  avgProcessingLatencyMs: number | null
  idempotencyConflictCount: number | null
  workerHealthScore: number | null
}): number {
  const depth = input.queueDepth ?? 0
  const failed = input.failedExecutionCount ?? 0
  const replay = input.replayPendingCount ?? 0
  const latency = input.avgProcessingLatencyMs ?? 0
  const conflicts = input.idempotencyConflictCount ?? 0
  const worker = input.workerHealthScore ?? 50

  const depthPenalty = Math.min(40, depth * 2)
  const failPenalty = Math.min(35, failed * 5)
  const replayPenalty = Math.min(25, replay * 3)
  const latencyPenalty = Math.min(30, Math.floor(latency / 200))
  const conflictPenalty = Math.min(25, conflicts * 5)
  const base = 100 - depthPenalty - failPenalty - replayPenalty - latencyPenalty - conflictPenalty
  return clamp01to100((base + worker) / 2)
}

export function deriveWorkerHealthScoreFromRates(input: {
  workflowFailureRatePct: number
  idempotencyConflictRatePct: number
}): number {
  const wf = Math.min(60, input.workflowFailureRatePct * 1.2)
  const idem = Math.min(40, input.idempotencyConflictRatePct * 1.5)
  return clamp01to100(100 - wf - idem)
}

export function deriveMultiRegionReadinessScore(
  rows: ReadonlyArray<{ sync_status: string; region_health_score: number | null }>,
): number {
  if (!rows.length) return 100
  let sum = 0
  for (const r of rows) {
    const health = r.region_health_score != null ? clamp01to100(r.region_health_score) : 70
    const statusFactor =
      r.sync_status === "active" ? 1
      : r.sync_status === "degraded" ? 0.85
      : r.sync_status === "replaying" ? 0.75
      : r.sync_status === "offline" ? 0.5
      : 0.35
    sum += health * statusFactor
  }
  return clamp01to100(sum / rows.length)
}

export function deriveObservabilityCoverageRate(hashedCount: number, total: number): number {
  const t = Math.max(1, Math.min(BLITZPAY_OBSERVABILITY_EVENT_LIST_CAP, total))
  return clamp01to100((hashedCount / t) * 100)
}

export function deriveReplayIntegrityScore(replayed: number, completed: number): number {
  const denom = Math.max(1, completed + replayed)
  return clamp01to100((replayed / denom) * 100)
}

function ratePct(numerator: number, denom: number): number {
  const d = Math.max(1, Math.min(BLITZPAY_WORKFLOW_LIST_CAP, denom))
  return clamp01to100((numerator / d) * 100)
}

export function detectBlitzpayQueueBackpressure(input: {
  queueDepth: number | null
  avgProcessingLatencyMs: number | null
}): boolean {
  const q = input.queueDepth ?? 0
  const l = input.avgProcessingLatencyMs ?? 0
  return q >= 25 || l >= 5000
}

/**
 * Bounded reads for FCC / reporting — metrics only.
 */
export async function buildPhase6bObservabilityReportingSlice(
  admin: SupabaseClient,
  organizationId: string,
): Promise<BlitzpayPhase6bReportingSlice> {
  const zeros: BlitzpayPhase6bReportingSlice = {
    queueHealthScore: 100,
    workflowFailureRate: 0,
    idempotencyConflictRate: 0,
    replayPendingCount: 0,
    observabilityCoverageRate: 0,
    workerHealthScore: 100,
    multiRegionReadinessScore: 100,
    replayIntegrityScore: 0,
  }

  try {
    const [wfRes, idemRes, evRes, snapRes, regRes] = await Promise.all([
      admin
        .from("blitzpay_workflow_executions")
        .select("execution_status")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(BLITZPAY_WORKFLOW_LIST_CAP),
      admin
        .from("blitzpay_idempotency_records")
        .select("request_status")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(BLITZPAY_OBSERVABILITY_IDEMPOTENCY_LIST_CAP),
      admin
        .from("blitzpay_financial_events")
        .select("event_status, event_hash")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(BLITZPAY_OBSERVABILITY_EVENT_LIST_CAP),
      admin
        .from("blitzpay_queue_health_snapshots")
        .select(
          "queue_depth, failed_execution_count, replay_pending_count, avg_processing_latency_ms, idempotency_conflict_count, worker_health_score",
        )
        .eq("organization_id", organizationId)
        .eq("snapshot_scope", "org")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("blitzpay_multi_region_sync_state")
        .select("sync_status, region_health_score")
        .eq("organization_id", organizationId)
        .order("updated_at", { ascending: false })
        .limit(BLITZPAY_OBSERVABILITY_REGION_CAP),
    ])

    if (wfRes.error || idemRes.error || evRes.error || snapRes.error) return zeros

    const wfRows = (wfRes.data ?? []) as Array<{ execution_status: string }>
    const failedWf = wfRows.filter((r) => r.execution_status === "failed").length
    const replayPendingWf = wfRows.filter((r) => r.execution_status === "failed").length
    const workflowFailureRate = ratePct(failedWf, wfRows.length)

    const idemRows = (idemRes.data ?? []) as Array<{ request_status: string }>
    const rejected = idemRows.filter((r) => r.request_status === "rejected").length
    const idempotencyConflictRate = ratePct(rejected, idemRows.length)

    const evRows = (evRes.data ?? []) as Array<{ event_status: string; event_hash: string | null }>
    const hashed = evRows.filter((r) => Boolean(r.event_hash)).length
    const observabilityCoverageRate = deriveObservabilityCoverageRate(hashed, evRows.length)
    const replayed = evRows.filter((r) => r.event_status === "replayed").length
    const completed = evRows.filter((r) => r.event_status === "completed").length
    const replayIntegrityScore = deriveReplayIntegrityScore(replayed, completed)

    const snap = snapRes.data as {
      queue_depth: number | null
      failed_execution_count: number | null
      replay_pending_count: number | null
      avg_processing_latency_ms: number | null
      idempotency_conflict_count: number | null
      worker_health_score: number | null
    } | null

    const workerHealthScore = deriveWorkerHealthScoreFromRates({
      workflowFailureRatePct: workflowFailureRate,
      idempotencyConflictRatePct: idempotencyConflictRate,
    })

    const queueHealthScore =
      snap ?
        deriveQueueHealthScoreFromSnapshot({
          queueDepth: snap.queue_depth,
          failedExecutionCount: snap.failed_execution_count,
          replayPendingCount: snap.replay_pending_count,
          avgProcessingLatencyMs: snap.avg_processing_latency_ms,
          idempotencyConflictCount: snap.idempotency_conflict_count,
          workerHealthScore: snap.worker_health_score ?? workerHealthScore,
        })
      : deriveQueueHealthScoreFromSnapshot({
          queueDepth: null,
          failedExecutionCount: failedWf,
          replayPendingCount: replayPendingWf,
          avgProcessingLatencyMs: null,
          idempotencyConflictCount: rejected,
          workerHealthScore,
        })

    const regRows =
      regRes.error ? [] : ((regRes.data ?? []) as Array<{ sync_status: string; region_health_score: number | null }>)
    const multiRegionReadinessScore = deriveMultiRegionReadinessScore(regRows)

    const replayPendingCount = Math.min(
      1000,
      snap?.replay_pending_count ?? replayPendingWf,
    )

    return {
      queueHealthScore,
      workflowFailureRate,
      idempotencyConflictRate,
      replayPendingCount,
      observabilityCoverageRate,
      workerHealthScore,
      multiRegionReadinessScore,
      replayIntegrityScore,
    }
  } catch {
    return zeros
  }
}

export function summarizeBlitzpayObservabilityHealth(input: BlitzpayPhase6bReportingSlice): {
  overallScore: number
  backpressure: boolean
} {
  const overallScore = clamp01to100(
    (input.queueHealthScore +
      input.workerHealthScore +
      input.multiRegionReadinessScore +
      input.observabilityCoverageRate +
      (100 - Math.min(100, input.workflowFailureRate)) +
      (100 - Math.min(100, input.idempotencyConflictRate))) /
      6,
  )
  return {
    overallScore,
    backpressure: input.queueHealthScore < 55 || input.replayPendingCount >= 10,
  }
}

export async function fetchBlitzpayObservabilityAuditTail(
  admin: SupabaseClient,
  organizationId: string,
): Promise<Array<{ id: string; audit_type: string; audit_summary: string; created_at: string }>> {
  const { data, error } = await admin
    .from("blitzpay_observability_audit_log")
    .select("id, audit_type, audit_summary, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(BLITZPAY_OBSERVABILITY_AUDIT_LIST_CAP)
  if (error) return []
  return (data ?? []) as Array<{ id: string; audit_type: string; audit_summary: string; created_at: string }>
}
