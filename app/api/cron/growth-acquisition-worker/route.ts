import { createServiceRoleClient } from "@/lib/supabase/admin"
import { processBulkAcquisitionRuns } from "@/lib/growth/acquisition/acquisition-cron-worker"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"

export const runtime = "nodejs"
export const maxDuration = 120

const CRON_ROUTE = growthCronApiPath("growth-acquisition-worker")

export async function POST(request: Request) {
  const admin = createServiceRoleClient()
  return runGrowthCronJob(
    { cronRoute: CRON_ROUTE, category: "discovery", request, admin, enforceProductionSafety: false },
    async () => {
      const maxRuns = Math.min(
        Math.max(Number.parseInt(process.env.GROWTH_ACQUISITION_CRON_MAX_RUNS ?? "3", 10) || 3, 1),
        10,
      )
      const maxTicksPerRun = Math.min(
        Math.max(
          Number.parseInt(process.env.GROWTH_ACQUISITION_CRON_MAX_TICKS ?? "20", 10) || 20,
          1,
        ),
        50,
      )

      return processBulkAcquisitionRuns(admin, {
        maxRuns,
        maxTicksPerRun,
        maxDurationMs: 110_000,
      })
    },
    (result) => ({
      processedCount: result.ticks_executed,
      failedCount: 0,
      skippedCount: 0,
      metadata: {
        runs_processed: result.runs_processed,
        runs_completed: result.runs_completed,
        runs: result.runs,
      },
    }),
  )
}

export async function GET(request: Request) {
  return POST(request)
}
