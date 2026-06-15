/** Phase GE-HARDEN-2 — Static + live database performance audit (server-only). */

import "server-only"

import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { PERFORMANCE_THRESHOLDS } from "@/lib/growth/e2e/growth-engine-performance-thresholds"
import type { DatabasePerformanceFinding } from "@/lib/growth/e2e/growth-engine-performance-types"
import { isGrowthSignalFoundationSchemaReady } from "@/lib/growth/signals/signal-schema-health"

const SERVICE_FILES_TO_AUDIT = [
  "lib/growth/command-center-unification/command-center-unification-service.ts",
  "lib/growth/agent-orchestration/agent-orchestration-service.ts",
  "lib/growth/operator-inbox/operator-inbox-service.ts",
  "lib/growth/signal-intelligence/signal-feed-repository.ts",
] as const

export async function auditDatabasePerformance(
  admin: SupabaseClient,
): Promise<{ findings: DatabasePerformanceFinding[]; query_timings_ms: Record<string, number> }> {
  const findings: DatabasePerformanceFinding[] = []
  const query_timings_ms: Record<string, number> = {}

  for (const relativePath of SERVICE_FILES_TO_AUDIT) {
    const absolutePath = path.join(process.cwd(), relativePath)
    if (!fs.existsSync(absolutePath)) continue

    const source = fs.readFileSync(absolutePath, "utf8")
    const promiseAllCount = (source.match(/Promise\.all/g) ?? []).length
    const awaitCount = (source.match(/\bawait\b/g) ?? []).length

    if (promiseAllCount === 0 && awaitCount > 5) {
      findings.push({
        finding_id: `sequential_${relativePath}`,
        severity: "warning",
        category: "sequential_fetch",
        description: `${relativePath} has ${awaitCount} awaits but no Promise.all parallelization`,
        hint: "Batch independent subsystem fetches with Promise.all to reduce aggregation latency",
      })
    }

    if (/for\s*\([^)]*\)\s*\{[^}]*await/.test(source)) {
      findings.push({
        finding_id: `n_plus_one_${relativePath}`,
        severity: "warning",
        category: "n_plus_one",
        description: `Potential N+1 await loop in ${relativePath}`,
        hint: "Replace sequential loops with batched queries or Promise.all",
      })
    }
  }

  findings.push({
    finding_id: "index_signal_events_org_occurred",
    severity: "info",
    category: "missing_index",
    description: "Recommend composite index on growth.signal_events (organization_id, occurred_at DESC)",
    hint: "Speeds unified timeline, signal feed, and audit health queries",
  })

  findings.push({
    finding_id: "index_signal_events_event_type",
    severity: "info",
    category: "missing_index",
    description: "Recommend index on growth.signal_events (event_type) for routed/scored filters",
    hint: "Reduces full-table scans in signal feed and realtime event normalization",
  })

  if (!(await isGrowthSignalFoundationSchemaReady(admin))) {
    findings.push({
      finding_id: "schema_not_ready",
      severity: "critical",
      category: "slow_query",
      description: "growth.signal_events schema not ready",
      hint: "Run signal foundation migration before production performance validation",
    })
    return { findings, query_timings_ms }
  }

  const organization_id = getGrowthEngineAiOrgId()

  const timedQuery = async (label: string, fn: () => Promise<unknown>) => {
    const start = performance.now()
    await fn()
    query_timings_ms[label] = Math.round(performance.now() - start)
  }

  await timedQuery("signal_events_recent_500", async () => {
    let query = admin
      .schema("growth")
      .from("signal_events")
      .select("id, event_type, event_payload, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(500)
    if (organization_id) query = query.eq("organization_id", organization_id)
    const { error } = await query
    if (error) throw error
  })

  await timedQuery("signal_events_count_90d", async () => {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    let query = admin
      .schema("growth")
      .from("signal_events")
      .select("id", { count: "exact", head: true })
      .gte("occurred_at", since)
    if (organization_id) query = query.eq("organization_id", organization_id)
    const { error } = await query
    if (error) throw error
  })

  for (const [label, ms] of Object.entries(query_timings_ms)) {
    if (ms > PERFORMANCE_THRESHOLDS.db_query_slow_ms) {
      findings.push({
        finding_id: `slow_${label}`,
        severity: "warning",
        category: "slow_query",
        description: `Query ${label} took ${ms}ms`,
        hint: "Review query plan, add indexes, or reduce selected columns",
        duration_ms: ms,
      })
    }
  }

  findings.push({
    finding_id: "query_count_aggregation",
    severity: "info",
    category: "query_count",
    description: "Command center unification issues ~10 parallel subsystem fetches per workspace load",
    hint: "Monitor total query count; consider unified read model if fetch count exceeds 15 per request",
  })

  return { findings, query_timings_ms }
}
