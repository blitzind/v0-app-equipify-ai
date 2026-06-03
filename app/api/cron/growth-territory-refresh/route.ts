import { createServiceRoleClient } from "@/lib/supabase/admin"
import {
  processTerritoryRefreshQueue,
  queueStaleTerritoryRefresh,
} from "@/lib/growth/territory-intelligence/territory-repository"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"

export const runtime = "nodejs"

const CRON_ROUTE = growthCronApiPath("growth-territory-refresh")

export async function POST(request: Request) {
  const admin = createServiceRoleClient()
  return runGrowthCronJob(
    { cronRoute: CRON_ROUTE, category: "intelligence", request, admin, enforceProductionSafety: false },
    async () => {
      const queued = await queueStaleTerritoryRefresh(admin, 50)
      const result = await processTerritoryRefreshQueue(admin, 25)
      return { queued, ...result }
    },
  )
}

/** Vercel Cron invokes scheduled routes with GET. */
export async function GET(request: Request) {
  return POST(request)
}
