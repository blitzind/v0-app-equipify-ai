import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { deriveQueueHealthScoreFromSnapshot } from "@/lib/blitzpay/blitzpay-observability"

export type BlitzpayPlatformObservabilityRollup = {
  reportingWindowDays: number
  generatedAt: string
  orgSnapshotsSampled: number
  averageQueueHealthScoreApprox: number
  averageWorkerHealthScoreApprox: number
  orgsWithReplayBacklogApprox: number
  orgsWithQueueDepthApprox: number
  disclaimer: string
}

const DISCLAIMER =
  "Platform observability rollups use bounded samples for admin visibility only. They do not trigger financial execution or autonomous remediation."

/**
 * Latest org-scoped queue health rows (bounded), de-duplicated per organization.
 */
export async function fetchBlitzpayPlatformObservabilityRollup(
  admin: SupabaseClient,
  opts?: { reportingWindowDays?: number },
): Promise<BlitzpayPlatformObservabilityRollup> {
  const reportingWindowDays = Math.min(90, Math.max(7, Math.round(Number(opts?.reportingWindowDays ?? 30))))
  const { data, error } = await admin
    .from("blitzpay_queue_health_snapshots")
    .select(
      "organization_id, queue_depth, failed_execution_count, replay_pending_count, avg_processing_latency_ms, idempotency_conflict_count, worker_health_score, created_at",
    )
    .eq("snapshot_scope", "org")
    .not("organization_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(400)

  if (error) {
    return {
      reportingWindowDays,
      generatedAt: new Date().toISOString(),
      orgSnapshotsSampled: 0,
      averageQueueHealthScoreApprox: 100,
      averageWorkerHealthScoreApprox: 100,
      orgsWithReplayBacklogApprox: 0,
      orgsWithQueueDepthApprox: 0,
      disclaimer: DISCLAIMER,
    }
  }

  const rows = (data ?? []) as Array<{
    organization_id: string
    queue_depth: number | null
    failed_execution_count: number | null
    replay_pending_count: number | null
    avg_processing_latency_ms: number | null
    idempotency_conflict_count: number | null
    worker_health_score: number | null
  }>

  const latestByOrg = new Map<string, (typeof rows)[0]>()
  for (const r of rows) {
    if (!r.organization_id) continue
    if (!latestByOrg.has(r.organization_id)) latestByOrg.set(r.organization_id, r)
    if (latestByOrg.size >= 60) break
  }

  const picked = [...latestByOrg.values()]
  let qhSum = 0
  let whSum = 0
  let replayBacklog = 0
  let depthOrgs = 0
  for (const r of picked) {
    const qh = deriveQueueHealthScoreFromSnapshot({
      queueDepth: r.queue_depth,
      failedExecutionCount: r.failed_execution_count,
      replayPendingCount: r.replay_pending_count,
      avgProcessingLatencyMs: r.avg_processing_latency_ms,
      idempotencyConflictCount: r.idempotency_conflict_count,
      workerHealthScore: r.worker_health_score,
    })
    qhSum += qh
    whSum += r.worker_health_score ?? qh
    const rp = r.replay_pending_count ?? 0
    if (rp >= 3) replayBacklog += 1
    const qd = r.queue_depth ?? 0
    if (qd >= 10) depthOrgs += 1
  }

  const n = Math.max(1, picked.length)
  return {
    reportingWindowDays,
    generatedAt: new Date().toISOString(),
    orgSnapshotsSampled: picked.length,
    averageQueueHealthScoreApprox: Math.round(qhSum / n),
    averageWorkerHealthScoreApprox: Math.round(whSum / n),
    orgsWithReplayBacklogApprox: replayBacklog,
    orgsWithQueueDepthApprox: depthOrgs,
    disclaimer: DISCLAIMER,
  }
}
