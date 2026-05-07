import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Phase 4: lightweight read-only aggregation helpers for the platform admin
 * "Import Operations" panel. All queries use the service-role client; the
 * caller (platform admin route handlers) gates access via `isPlatformAdminEmail`.
 *
 * No runner state is mutated here. Counts intentionally mirror cron counters
 * + run history exposed in earlier phases.
 */

export type ImportOpsRunSummary = {
  runId: string
  runRef: string
  status: string
  importJobId: string
  importJobRef: string
  importKind: string
  organizationId: string
  organizationName: string | null
  totalRows: number
  processedCount: number
  errorCount: number
  retryCount: number
  maxRetries: number
  nextRetryAt: string | null
  leaseExpiresAt: string | null
  lastHeartbeatAt: string | null
  startedAt: string | null
  completedAt: string | null
  updatedAt: string | null
  createdAt: string | null
  errorMessage: string | null
  recovery: Record<string, unknown> | null
  staleLeaseRecoveredAt: string | null
  isLikelyStuck: boolean
}

export type ImportOpsHealthCounts = {
  queued: number
  processing: number
  retrying: number
  failed: number
  completedRecent: number
  staleLeaseRecoveredRecent: number
  stuckRunsApprox: number
}

export type ImportOpsMetrics = {
  generatedAt: string
  windowHours: number
  health: ImportOpsHealthCounts
  totals: {
    runsTotal: number
    runsLast24h: number
  }
  recentTerminalThroughput: {
    last24h: { completed: number; failed: number; cancelled: number; completedWithErrors: number }
    last7d: { completed: number; failed: number; cancelled: number; completedWithErrors: number }
  }
}

const STALE_LEASE_GRACE_SECONDS = 120
const RECENT_WINDOW_HOURS = 24
const RECENT_LONG_WINDOW_HOURS = 24 * 7

const RUN_FIELDS =
  "id, status, import_job_id, organization_id, total_rows, processed_count, error_count, retry_count, max_retries, next_retry_at, lease_expires_at, last_heartbeat_at, started_at, completed_at, updated_at, created_at, error_message, recovery_json"

const JOB_FIELDS = "id, kind"

function runRef(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase()
}

function importRefFor(id: string): string {
  return `IMP-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`
}

function isLikelyStuck(row: Record<string, unknown>): boolean {
  const status = String(row.status ?? "")
  if (status !== "processing") return false
  const lease = (row.lease_expires_at as string | null) ?? null
  const hb = (row.last_heartbeat_at as string | null) ?? null
  const nowMs = Date.now()
  const leaseMs = lease ? new Date(lease).getTime() : 0
  const hbMs = hb ? new Date(hb).getTime() : 0
  if (leaseMs && Number.isFinite(leaseMs) && leaseMs < nowMs) return true
  if (hbMs && Number.isFinite(hbMs) && nowMs - hbMs > STALE_LEASE_GRACE_SECONDS * 1000) return true
  return false
}

async function countRuns(svc: SupabaseClient, build: (q: ReturnType<SupabaseClient["from"]>) => unknown): Promise<number> {
  const base = svc.from("organization_import_job_runs").select("id", { count: "exact", head: true })
  const final = build(base) as { then: (cb: (r: { count: number | null }) => void) => Promise<{ count: number | null }> }
  const { count } = await (final as unknown as Promise<{ count: number | null }>)
  return count ?? 0
}

export async function fetchImportOpsMetrics(svc: SupabaseClient): Promise<ImportOpsMetrics> {
  const now = new Date()
  const recentSinceIso = new Date(now.getTime() - RECENT_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
  const longSinceIso = new Date(now.getTime() - RECENT_LONG_WINDOW_HOURS * 60 * 60 * 1000).toISOString()

  const [
    queuedCount,
    processingCount,
    retryingCount,
    failedCount,
    completedRecentCount,
    runsTotal,
    runsLast24h,
    completedLast24h,
    failedLast24h,
    cancelledLast24h,
    completedErrLast24h,
    completedLast7d,
    failedLast7d,
    cancelledLast7d,
    completedErrLast7d,
  ] = await Promise.all([
    countRuns(svc, (q) => (q as unknown as { eq: (a: string, b: string) => unknown }).eq("status", "queued")),
    countRuns(svc, (q) => (q as unknown as { eq: (a: string, b: string) => unknown }).eq("status", "processing")),
    countRuns(svc, (q) => {
      const eq = (q as unknown as { eq: (a: string, b: string) => unknown })
      const after = eq.eq("status", "queued") as unknown as { gt: (a: string, b: number) => unknown }
      return after.gt("retry_count", 0)
    }),
    countRuns(svc, (q) => (q as unknown as { eq: (a: string, b: string) => unknown }).eq("status", "failed")),
    countRuns(svc, (q) => {
      const eq = (q as unknown as { eq: (a: string, b: string) => unknown })
      const after = eq.eq("status", "completed") as unknown as { gte: (a: string, b: string) => unknown }
      return after.gte("completed_at", recentSinceIso)
    }),
    countRuns(svc, (q) => q),
    countRuns(svc, (q) => (q as unknown as { gte: (a: string, b: string) => unknown }).gte("created_at", recentSinceIso)),
    countRuns(svc, (q) => {
      const eq = (q as unknown as { eq: (a: string, b: string) => unknown })
      const after = eq.eq("status", "completed") as unknown as { gte: (a: string, b: string) => unknown }
      return after.gte("completed_at", recentSinceIso)
    }),
    countRuns(svc, (q) => {
      const eq = (q as unknown as { eq: (a: string, b: string) => unknown })
      const after = eq.eq("status", "failed") as unknown as { gte: (a: string, b: string) => unknown }
      return after.gte("completed_at", recentSinceIso)
    }),
    countRuns(svc, (q) => {
      const eq = (q as unknown as { eq: (a: string, b: string) => unknown })
      const after = eq.eq("status", "cancelled") as unknown as { gte: (a: string, b: string) => unknown }
      return after.gte("completed_at", recentSinceIso)
    }),
    countRuns(svc, (q) => {
      const eq = (q as unknown as { eq: (a: string, b: string) => unknown })
      const after = eq.eq("status", "completed_with_errors") as unknown as { gte: (a: string, b: string) => unknown }
      return after.gte("completed_at", recentSinceIso)
    }),
    countRuns(svc, (q) => {
      const eq = (q as unknown as { eq: (a: string, b: string) => unknown })
      const after = eq.eq("status", "completed") as unknown as { gte: (a: string, b: string) => unknown }
      return after.gte("completed_at", longSinceIso)
    }),
    countRuns(svc, (q) => {
      const eq = (q as unknown as { eq: (a: string, b: string) => unknown })
      const after = eq.eq("status", "failed") as unknown as { gte: (a: string, b: string) => unknown }
      return after.gte("completed_at", longSinceIso)
    }),
    countRuns(svc, (q) => {
      const eq = (q as unknown as { eq: (a: string, b: string) => unknown })
      const after = eq.eq("status", "cancelled") as unknown as { gte: (a: string, b: string) => unknown }
      return after.gte("completed_at", longSinceIso)
    }),
    countRuns(svc, (q) => {
      const eq = (q as unknown as { eq: (a: string, b: string) => unknown })
      const after = eq.eq("status", "completed_with_errors") as unknown as { gte: (a: string, b: string) => unknown }
      return after.gte("completed_at", longSinceIso)
    }),
  ])

  // Stale-lease recovery counter (last window) and stuck-run approximation are
  // derived from a small recent-rows scan to avoid heavy aggregation.
  const { data: recoveryRows } = await svc
    .from("organization_import_job_runs")
    .select("recovery_json, status, lease_expires_at, last_heartbeat_at, updated_at")
    .gte("updated_at", recentSinceIso)
    .limit(500)
  let staleLeaseRecoveredRecent = 0
  let stuckApprox = 0
  for (const r of (recoveryRows ?? []) as Array<Record<string, unknown>>) {
    const recovered = (r.recovery_json as Record<string, unknown> | null)?.stale_lease_recovered_at
    if (typeof recovered === "string" && recovered >= recentSinceIso) staleLeaseRecoveredRecent += 1
    if (isLikelyStuck(r)) stuckApprox += 1
  }

  return {
    generatedAt: now.toISOString(),
    windowHours: RECENT_WINDOW_HOURS,
    health: {
      queued: queuedCount,
      processing: processingCount,
      retrying: retryingCount,
      failed: failedCount,
      completedRecent: completedRecentCount,
      staleLeaseRecoveredRecent,
      stuckRunsApprox: stuckApprox,
    },
    totals: {
      runsTotal,
      runsLast24h,
    },
    recentTerminalThroughput: {
      last24h: {
        completed: completedLast24h,
        failed: failedLast24h,
        cancelled: cancelledLast24h,
        completedWithErrors: completedErrLast24h,
      },
      last7d: {
        completed: completedLast7d,
        failed: failedLast7d,
        cancelled: cancelledLast7d,
        completedWithErrors: completedErrLast7d,
      },
    },
  }
}

export type ImportOpsRunFilters = {
  status?: string[]
  organizationId?: string
  importKind?: string
  search?: string
  stuckOnly?: boolean
  limit?: number
}

export async function searchImportOpsRuns(
  svc: SupabaseClient,
  filters: ImportOpsRunFilters,
): Promise<ImportOpsRunSummary[]> {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200)

  let runQ = svc
    .from("organization_import_job_runs")
    .select(RUN_FIELDS)
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (filters.status && filters.status.length > 0) {
    runQ = runQ.in("status", filters.status)
  }
  if (filters.organizationId) {
    runQ = runQ.eq("organization_id", filters.organizationId)
  }

  const { data: runRows } = await runQ
  let rows = (runRows ?? []) as Array<Record<string, unknown>>

  if (filters.stuckOnly) {
    rows = rows.filter(isLikelyStuck)
  }

  const jobIds = [...new Set(rows.map((r) => String(r.import_job_id ?? "")))].filter(Boolean)
  let jobRows: Array<Record<string, unknown>> = []
  if (jobIds.length > 0) {
    const { data: jobs } = await svc
      .from("organization_import_jobs")
      .select(JOB_FIELDS)
      .in("id", jobIds)
    jobRows = (jobs ?? []) as Array<Record<string, unknown>>
  }
  const jobById = new Map<string, Record<string, unknown>>()
  for (const j of jobRows) jobById.set(String(j.id ?? ""), j)

  const orgIds = [...new Set(rows.map((r) => String(r.organization_id ?? "")))].filter(Boolean)
  let orgRows: Array<Record<string, unknown>> = []
  if (orgIds.length > 0) {
    const { data: orgs } = await svc.from("organizations").select("id, name").in("id", orgIds)
    orgRows = (orgs ?? []) as Array<Record<string, unknown>>
  }
  const orgNameById = new Map<string, string | null>()
  for (const o of orgRows) orgNameById.set(String(o.id ?? ""), (o.name as string | null) ?? null)

  let summaries: ImportOpsRunSummary[] = rows.map((r) => {
    const id = String(r.id ?? "")
    const jobId = String(r.import_job_id ?? "")
    const job = jobById.get(jobId)
    return {
      runId: id,
      runRef: runRef(id),
      status: String(r.status ?? "queued"),
      importJobId: jobId,
      importJobRef: importRefFor(jobId),
      importKind: String((job?.kind as string | null) ?? "unknown"),
      organizationId: String(r.organization_id ?? ""),
      organizationName: orgNameById.get(String(r.organization_id ?? "")) ?? null,
      totalRows: Number(r.total_rows ?? 0),
      processedCount: Number(r.processed_count ?? 0),
      errorCount: Number(r.error_count ?? 0),
      retryCount: Number(r.retry_count ?? 0),
      maxRetries: Number(r.max_retries ?? 0),
      nextRetryAt: (r.next_retry_at as string | null) ?? null,
      leaseExpiresAt: (r.lease_expires_at as string | null) ?? null,
      lastHeartbeatAt: (r.last_heartbeat_at as string | null) ?? null,
      startedAt: (r.started_at as string | null) ?? null,
      completedAt: (r.completed_at as string | null) ?? null,
      updatedAt: (r.updated_at as string | null) ?? null,
      createdAt: (r.created_at as string | null) ?? null,
      errorMessage: (r.error_message as string | null) ?? null,
      recovery: (r.recovery_json as Record<string, unknown> | null) ?? null,
      staleLeaseRecoveredAt:
        ((r.recovery_json as Record<string, unknown> | null)?.stale_lease_recovered_at as string | null) ?? null,
      isLikelyStuck: isLikelyStuck(r),
    }
  })

  if (filters.importKind) {
    summaries = summaries.filter((s) => s.importKind === filters.importKind)
  }

  const search = (filters.search ?? "").trim().toLowerCase()
  if (search) {
    summaries = summaries.filter((s) => {
      const haystack = [
        s.runRef,
        s.importJobRef,
        s.importKind,
        s.organizationName ?? "",
        s.errorMessage ?? "",
        s.status,
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(search)
    })
  }

  return summaries
}

export type ImportOpsOrgOption = { id: string; name: string }

export async function listImportOpsOrganizationOptions(svc: SupabaseClient): Promise<ImportOpsOrgOption[]> {
  const { data } = await svc
    .from("organization_import_job_runs")
    .select("organization_id")
    .order("organization_id", { ascending: true })
    .limit(2000)
  const ids = [...new Set((data ?? []).map((r: { organization_id?: string }) => String(r.organization_id ?? "")))].filter(
    Boolean,
  )
  if (ids.length === 0) return []
  const { data: orgs } = await svc.from("organizations").select("id, name").in("id", ids)
  return ((orgs ?? []) as Array<{ id: string; name: string | null }>)
    .map((o) => ({ id: String(o.id), name: String(o.name ?? "(unnamed)") }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function listImportOpsKindOptions(svc: SupabaseClient): Promise<string[]> {
  const { data } = await svc
    .from("organization_import_jobs")
    .select("kind")
    .order("kind", { ascending: true })
    .limit(500)
  const set = new Set<string>()
  for (const r of (data ?? []) as Array<{ kind?: string }>) {
    if (r.kind) set.add(String(r.kind))
  }
  return [...set].sort()
}
