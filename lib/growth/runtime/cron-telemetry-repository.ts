import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthCronExecutionCategory,
  GrowthCronExecutionRunRecord,
  GrowthCronRouteHealth,
  GrowthCronRouteId,
} from "@/lib/growth/runtime/cron-telemetry-types"
import {
  GROWTH_CRON_ROUTE_IDS,
  growthCronApiPath,
} from "@/lib/growth/runtime/cron-telemetry-types"

export const GROWTH_CRON_EXECUTION_TELEMETRY_MIGRATION =
  "20270527123000_growth_engine_cron_execution_telemetry.sql" as const

export const GROWTH_CRON_EXECUTION_TELEMETRY_GRANTS_MIGRATION =
  "20270617121000_growth_cron_execution_runs_service_role_grants.sql" as const

type RunRow = {
  id: string
  cron_route: string
  category: string
  started_at: string
  finished_at: string
  duration_ms: number
  ok: boolean
  processed_count: number
  failed_count: number
  skipped_count: number
  error_message: string | null
  metadata: Record<string, unknown> | null
}

function runsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("cron_execution_runs")
}

export async function isGrowthCronTelemetrySchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await runsTable(admin).select("id").limit(1)
  return !error
}

export type GrowthCronTelemetrySchemaProbe = {
  ready: boolean
  errorCode: string | null
  errorMessage: string | null
}

export async function probeGrowthCronTelemetrySchema(
  admin: SupabaseClient,
): Promise<GrowthCronTelemetrySchemaProbe> {
  const { error } = await runsTable(admin).select("id").limit(1)
  if (!error) {
    return { ready: true, errorCode: null, errorMessage: null }
  }
  return {
    ready: false,
    errorCode: error.code ?? null,
    errorMessage: error.message,
  }
}

function mapRow(row: RunRow): GrowthCronExecutionRunRecord {
  return {
    id: row.id,
    cronRoute: row.cron_route,
    category: row.category as GrowthCronExecutionCategory,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms,
    ok: row.ok,
    processedCount: row.processed_count,
    failedCount: row.failed_count,
    skippedCount: row.skipped_count,
    errorMessage: row.error_message,
    metadata: row.metadata ?? {},
  }
}

export type GrowthCronExecutionMetrics = {
  processedCount?: number
  failedCount?: number
  skippedCount?: number
  queueLagMinutes?: number | null
  metadata?: Record<string, unknown>
}

export async function recordGrowthCronExecutionRun(
  admin: SupabaseClient,
  input: {
    cronRoute: string
    category: GrowthCronExecutionCategory
    startedAt: string
    finishedAt: string
    ok: boolean
    errorMessage?: string | null
    metrics?: GrowthCronExecutionMetrics
  },
): Promise<GrowthCronExecutionRunRecord | null> {
  const schema = await probeGrowthCronTelemetrySchema(admin)
  if (!schema.ready) {
    console.error(
      "[growth-cron-telemetry] schema not ready:",
      JSON.stringify({
        code: schema.errorCode,
        message: schema.errorMessage,
        cronRoute: input.cronRoute,
      }),
    )
    return null
  }

  const durationMs = Math.max(0, Date.parse(input.finishedAt) - Date.parse(input.startedAt))
  const metrics = input.metrics ?? {}

  const { data, error } = await runsTable(admin)
    .insert({
      cron_route: input.cronRoute,
      category: input.category,
      started_at: input.startedAt,
      finished_at: input.finishedAt,
      duration_ms: durationMs,
      ok: input.ok,
      processed_count: metrics.processedCount ?? 0,
      failed_count: metrics.failedCount ?? 0,
      skipped_count: metrics.skippedCount ?? 0,
      error_message: input.errorMessage ?? null,
      metadata: {
        ...(metrics.metadata ?? {}),
        ...(metrics.queueLagMinutes != null ? { queue_lag_minutes: metrics.queueLagMinutes } : {}),
      },
    })
    .select("*")
    .single()

  if (error) {
    console.error(
      "[growth-cron-telemetry] insert failed:",
      JSON.stringify({
        message: error.message,
        code: error.code,
        cronRoute: input.cronRoute,
      }),
    )
    return null
  }

  return mapRow(data as RunRow)
}

export async function listRecentGrowthCronExecutionRuns(
  admin: SupabaseClient,
  input?: { cronRoute?: string; limit?: number },
): Promise<GrowthCronExecutionRunRecord[]> {
  if (!(await isGrowthCronTelemetrySchemaReady(admin))) return []

  let query = runsTable(admin).select("*").order("started_at", { ascending: false }).limit(input?.limit ?? 50)
  if (input?.cronRoute) query = query.eq("cron_route", input.cronRoute)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as RunRow[]).map(mapRow)
}

const ROUTE_CATEGORIES: Record<GrowthCronRouteId, GrowthCronExecutionCategory> = {
  "growth-outreach-execute": "outbound",
  "growth-sequence-scheduler": "outbound",
  "growth-sequence-safe-execute": "outbound",
  "growth-inbox-sync": "inbox",
  "growth-signal-ingest": "intelligence",
  "growth-discovery-worker": "discovery",
  "growth-company-signal-refresh": "intelligence",
  "growth-contact-refresh": "intelligence",
  "growth-territory-refresh": "intelligence",
  "growth-market-health-refresh": "intelligence",
  "growth-dns-verify": "intelligence",
  "growth-sequence-recovery": "outbound",
  "growth-sequence-wait-timeouts": "outbound",
  "growth-lifecycle-maintenance": "outbound",
  "growth-reputation-snapshot": "outbound",
  "growth-warmup-progression": "outbound",
  "growth-provider-runtime-diagnostics": "discovery",
  "growth-email-discovery-cert-run": "discovery",
}

export async function summarizeGrowthCronRouteHealth(
  admin: SupabaseClient,
  registeredRoutes: Set<string>,
): Promise<GrowthCronRouteHealth[]> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const recent = await listRecentGrowthCronExecutionRuns(admin, { limit: 500 })

  return GROWTH_CRON_ROUTE_IDS.map((routeId) => {
    const path = growthCronApiPath(routeId)
    const routeRuns = recent.filter((run) => run.cronRoute === path)
    const lastRun = routeRuns[0] ?? null
    const lastSuccess = routeRuns.find((run) => run.ok) ?? null
    const runs24h = routeRuns.filter((run) => run.startedAt >= since24h)

    const queueLagRaw = lastRun?.metadata?.queue_lag_minutes
    const queueLagMinutes =
      typeof queueLagRaw === "number" && Number.isFinite(queueLagRaw) ? queueLagRaw : null

    return {
      routeId,
      path,
      category: ROUTE_CATEGORIES[routeId],
      registered: registeredRoutes.has(path),
      lastSuccessAt: lastSuccess?.finishedAt ?? null,
      lastRunAt: lastRun?.finishedAt ?? null,
      lastDurationMs: lastRun?.durationMs ?? null,
      failureCount24h: runs24h.filter((run) => !run.ok).length,
      successCount24h: runs24h.filter((run) => run.ok).length,
      queueLagMinutes,
    }
  })
}

export function extractGrowthCronMetricsFromResult(result: unknown): GrowthCronExecutionMetrics {
  if (!result || typeof result !== "object") return {}
  const record = result as Record<string, unknown>

  const processed =
    asNumber(record.executed) +
    asNumber(record.processed) +
    asNumber(record.queued) +
    asNumber(record.refreshed) +
    asNumber(record.ingested)

  const failed = asNumber(record.failed) + asNumber(record.errors)
  const skipped = asNumber(record.skipped) + asNumber(record.cancelled)

  const summary = record.summary
  if (summary && typeof summary === "object") {
    const nested = extractGrowthCronMetricsFromResult(summary)
    return {
      processedCount: processed + (nested.processedCount ?? 0),
      failedCount: failed + (nested.failedCount ?? 0),
      skippedCount: skipped + (nested.skippedCount ?? 0),
      metadata: nested.metadata,
    }
  }

  return {
    processedCount: processed || undefined,
    failedCount: failed || undefined,
    skippedCount: skipped || undefined,
    metadata: record,
  }
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}
