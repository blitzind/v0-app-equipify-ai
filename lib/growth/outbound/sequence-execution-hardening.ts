import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { recordSequenceExecutionJobAuditEvent } from "@/lib/growth/sequences/execution/sequence-execution-events"
import { updateSequenceExecutionJob } from "@/lib/growth/sequences/execution/sequence-job-repository"

const STUCK_LOCK_TTL_MS = 30 * 60 * 1000

export type StuckSequenceJob = {
  jobId: string
  status: string
  lockedAt: string
  lockedBy: string | null
  attemptCount: number
  lastError: string | null
  stuckMinutes: number
}

export async function detectStuckSequenceJobs(
  admin: SupabaseClient,
  limit = 50,
): Promise<StuckSequenceJob[]> {
  const cutoff = new Date(Date.now() - STUCK_LOCK_TTL_MS).toISOString()
  const { data, error } = await admin
    .schema("growth")
    .from("sequence_execution_jobs")
    .select("id, status, locked_at, locked_by, attempt_count, last_error")
    .eq("status", "running")
    .not("locked_at", "is", null)
    .lt("locked_at", cutoff)
    .limit(limit)

  if (error) return []

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    jobId: String(row.id),
    status: String(row.status),
    lockedAt: String(row.locked_at),
    lockedBy: row.locked_by ? String(row.locked_by) : null,
    attemptCount: Number(row.attempt_count ?? 0),
    lastError: row.last_error ? String(row.last_error) : null,
    stuckMinutes: Math.round((Date.now() - Date.parse(String(row.locked_at))) / 60000),
  }))
}

export async function recoverStuckSequenceJobs(
  admin: SupabaseClient,
  input?: { actorUserId?: string; dryRun?: boolean },
): Promise<{ recovered: number; deadLettered: number }> {
  const stuck = await detectStuckSequenceJobs(admin)
  let recovered = 0
  let deadLettered = 0

  for (const job of stuck) {
    if (input?.dryRun) continue

    if (job.attemptCount >= 3) {
      await recordSequenceDeadLetter(admin, {
        jobId: job.jobId,
        reason: job.lastError ?? "Exceeded retry attempts while stuck.",
        diagnosticType: "dead_letter",
      })
      deadLettered += 1
      continue
    }

    await updateSequenceExecutionJob(admin, job.jobId, {
      status: "approved",
      lockedAt: null,
      lockedBy: null,
      lastError: "Recovered from stuck lock — operator/cron recovery.",
    })

    await admin.schema("growth").from("sequence_execution_diagnostics").insert({
      job_id: job.jobId,
      diagnostic_type: "stuck",
      severity: "high",
      title: "Stuck job recovered",
      summary: `Lock held ${job.stuckMinutes}m by ${job.lockedBy ?? "unknown"}.`,
      resolved: true,
      resolved_at: new Date().toISOString(),
      metadata: { recovered_by: input?.actorUserId ?? "system" },
    })

    await recordSequenceExecutionJobAuditEvent(admin, {
      jobId: job.jobId,
      eventType: "job_recovered",
      title: "Stuck execution job recovered",
      description: "Lock expired — job returned to approved for operator re-run.",
      severity: "medium",
    })

    recovered += 1
  }

  return { recovered, deadLettered }
}

export async function recordSequenceDeadLetter(
  admin: SupabaseClient,
  input: { jobId: string; reason: string; diagnosticType?: "dead_letter" | "duplicate_risk" },
): Promise<void> {
  await updateSequenceExecutionJob(admin, input.jobId, {
    status: "failed",
    lockedAt: null,
    lockedBy: null,
    lastError: input.reason.slice(0, 500),
  })

  await admin.schema("growth").from("sequence_execution_diagnostics").insert({
    job_id: input.jobId,
    diagnostic_type: input.diagnosticType ?? "dead_letter",
    severity: "critical",
    title: "Execution dead letter",
    summary: input.reason,
    metadata: { requires_operator_recovery: true },
  })

  await recordSequenceExecutionJobAuditEvent(admin, {
    jobId: input.jobId,
    eventType: "job_dead_letter",
    title: "Execution job dead-lettered",
    description: input.reason,
    severity: "critical",
  })
}

export async function listSequenceExecutionDiagnostics(
  admin: SupabaseClient,
  limit = 30,
): Promise<
  Array<{
    id: string
    jobId: string
    diagnosticType: string
    severity: string
    title: string
    summary: string | null
    resolved: boolean
    createdAt: string
  }>
> {
  const { data, error } = await admin
    .schema("growth")
    .from("sequence_execution_diagnostics")
    .select("id, job_id, diagnostic_type, severity, title, summary, resolved, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) return []

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    jobId: String(row.job_id),
    diagnosticType: String(row.diagnostic_type),
    severity: String(row.severity),
    title: String(row.title),
    summary: row.summary ? String(row.summary) : null,
    resolved: Boolean(row.resolved),
    createdAt: String(row.created_at),
  }))
}
