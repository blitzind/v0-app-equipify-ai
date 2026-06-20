import { createServiceRoleClient } from "@/lib/supabase/admin"
import { runAllEventRetentionBatches } from "@/lib/growth/runtime-guardrails/growth-event-retention-service"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"

export const runtime = "nodejs"

const CRON_ROUTE = growthCronApiPath("growth-event-retention")

/** Daily batch deletion of stale raw growth events — rollups preserved. */
export async function POST(request: Request) {
  const admin = createServiceRoleClient()
  return runGrowthCronJob(
    { cronRoute: CRON_ROUTE, category: "intelligence", request, admin },
    async () => {
      const batches = await runAllEventRetentionBatches(admin)
      const deletedCount = batches.reduce((sum, batch) => sum + batch.deletedCount, 0)
      return {
        batches,
        deleted_count: deletedCount,
        processed_count: batches.length,
      }
    },
    (result) => ({
      processedCount: result.processed_count,
      metadata: { deleted_count: result.deleted_count, batches: result.batches },
    }),
  )
}

export async function GET(request: Request) {
  return POST(request)
}
