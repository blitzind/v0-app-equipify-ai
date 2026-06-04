import { createServiceRoleClient } from "@/lib/supabase/admin"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"
import { runNativeWarmupProgressionBatch } from "@/lib/growth/warmup/warmup-execution"

export const runtime = "nodejs"

const CRON_ROUTE = growthCronApiPath("growth-warmup-progression")

export async function POST(request: Request) {
  const admin = createServiceRoleClient()
  return runGrowthCronJob(
    { cronRoute: CRON_ROUTE, category: "outbound", request, admin },
    async () => runNativeWarmupProgressionBatch(admin),
    (result) => ({
      processedCount: result.scanned,
      metadata: {
        qa_marker: result.qa_marker,
        capacity_synced: result.capacity_synced,
        day_advanced: result.day_advanced,
        throttled: result.throttled,
        activated: result.activated,
        daily_counters_reset: result.daily_counters_reset,
      },
    }),
  )
}

/** Vercel Cron invokes scheduled routes with GET. */
export async function GET(request: Request) {
  return POST(request)
}
