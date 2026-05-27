import { createServiceRoleClient } from "@/lib/supabase/admin"
import {
  processCompanyGrowthSignalRefreshQueue,
  queueStaleCompanyGrowthSignalRefresh,
} from "@/lib/growth/company-growth-signals/growth-signal-repository"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"

export const runtime = "nodejs"

const CRON_ROUTE = growthCronApiPath("growth-company-signal-refresh")

export async function POST(request: Request) {
  const admin = createServiceRoleClient()
  return runGrowthCronJob(
    { cronRoute: CRON_ROUTE, category: "intelligence", request, admin, enforceProductionSafety: false },
    async () => {
      const queued = await queueStaleCompanyGrowthSignalRefresh(admin, 50)
      const result = await processCompanyGrowthSignalRefreshQueue(admin, 25)
      return { queued, ...result }
    },
  )
}
