import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { runGrowthObjectiveRuntimeScheduler } from "@/lib/growth/objectives/growth-objective-runtime-scheduler"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"

export const runtime = "nodejs"

const CRON_ROUTE = growthCronApiPath("growth-objective-runtime-scheduler")

export async function POST(request: Request) {
  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 })
  }

  return runGrowthCronJob(
    { cronRoute: CRON_ROUTE, category: "intelligence", request, admin },
    async () => runGrowthObjectiveRuntimeScheduler(admin),
    (result) => ({
      processedCount: result.ticksAttempted + result.retriesAttempted,
      skippedCount: result.objectivesScanned - result.ticksAttempted - result.retriesAttempted,
      metadata: {
        qa_marker: result.qa_marker,
        objectives_scanned: result.objectivesScanned,
        stalled_detected: result.stalledDetected,
        recommendations_refreshed: result.recommendationsRefreshed,
        autonomous_sales_loop: result.autonomousSalesLoop
          ? {
              organizations_attempted: result.autonomousSalesLoop.organizations_attempted,
              organizations_executed: result.autonomousSalesLoop.organizations_executed,
              total_outcomes_completed: result.autonomousSalesLoop.total_outcomes_completed,
              skipped_reason: result.autonomousSalesLoop.skipped_reason,
            }
          : null,
      },
    }),
  )
}

export async function GET(request: Request) {
  return POST(request)
}
