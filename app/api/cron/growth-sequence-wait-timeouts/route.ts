import { createServiceRoleClient } from "@/lib/supabase/admin"
import { processExpiredSequenceWaits } from "@/lib/growth/sequences/conditions/sequence-wait-timeout-processor"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"

export const runtime = "nodejs"

/** Batch-resolve expired sequence enrollment step waits (timeout branches only — no transport). */
const CRON_ROUTE = growthCronApiPath("growth-sequence-wait-timeouts")

export async function POST(request: Request) {
  const admin = createServiceRoleClient()
  return runGrowthCronJob(
    { cronRoute: CRON_ROUTE, category: "outbound", request, admin },
    async () => {
      const summary = await processExpiredSequenceWaits(admin, { limit: 50 })
      return {
        summary,
        processed_count: summary.scanned,
        resolved_count: summary.resolved,
        blocked_count: summary.blocked,
        failed_count: summary.failed,
      }
    },
    (result) => ({
      processedCount: result.processed_count,
      failedCount: result.failed_count,
      metadata: { summary: result.summary },
    }),
  )
}

/** Vercel Cron invokes scheduled routes with GET. */
export async function GET(request: Request) {
  return POST(request)
}
