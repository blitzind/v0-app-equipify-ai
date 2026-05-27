import "server-only"

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { verifyGrowthCronRequest } from "@/lib/growth/runtime/growth-cron-auth"
import {
  extractGrowthCronMetricsFromResult,
  recordGrowthCronExecutionRun,
  type GrowthCronExecutionMetrics,
} from "@/lib/growth/runtime/cron-telemetry-repository"
import type { GrowthCronExecutionCategory } from "@/lib/growth/runtime/cron-telemetry-types"
import { assertGrowthProductionRuntimeSafe } from "@/lib/growth/runtime/runtime-guards"

export type GrowthCronJobContext = {
  cronRoute: string
  category: GrowthCronExecutionCategory
  request: Request
  admin: SupabaseClient
  enforceProductionSafety?: boolean
}

export async function runGrowthCronJob<T extends Record<string, unknown>>(
  ctx: GrowthCronJobContext,
  execute: () => Promise<T>,
  metricsOverride?: (result: T) => GrowthCronExecutionMetrics,
): Promise<NextResponse> {
  const unauthorized = verifyGrowthCronRequest(ctx.request)
  if (unauthorized) return unauthorized

  if (ctx.enforceProductionSafety !== false) {
    try {
      assertGrowthProductionRuntimeSafe(ctx.cronRoute)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return NextResponse.json({ error: "production_runtime_guard", message }, { status: 503 })
    }
  }

  const startedAt = new Date().toISOString()
  const startedMs = Date.now()

  try {
    const result = await execute()
    const finishedAt = new Date().toISOString()
    const metrics = metricsOverride?.(result) ?? extractGrowthCronMetricsFromResult(result)

    await recordGrowthCronExecutionRun(ctx.admin, {
      cronRoute: ctx.cronRoute,
      category: ctx.category,
      startedAt,
      finishedAt,
      ok: true,
      metrics: {
        ...metrics,
        metadata: {
          ...(metrics.metadata ?? {}),
          duration_ms_observed: Date.now() - startedMs,
        },
      },
    })

    console.info(
      `[growth-cron] ${ctx.cronRoute} ok processed=${metrics.processedCount ?? 0} failed=${metrics.failedCount ?? 0} duration_ms=${Date.now() - startedMs}`,
    )

    return NextResponse.json({ ok: true, cron_route: ctx.cronRoute, duration_ms: Date.now() - startedMs, ...result })
  } catch (error) {
    const finishedAt = new Date().toISOString()
    const message = error instanceof Error ? error.message : String(error)

    await recordGrowthCronExecutionRun(ctx.admin, {
      cronRoute: ctx.cronRoute,
      category: ctx.category,
      startedAt,
      finishedAt,
      ok: false,
      errorMessage: message,
    })

    console.error(`[growth-cron] ${ctx.cronRoute} failed:`, message)

    return NextResponse.json(
      { ok: false, cron_route: ctx.cronRoute, error: "cron_execution_failed", message, duration_ms: Date.now() - startedMs },
      { status: 500 },
    )
  }
}
