import { createServiceRoleClient } from "@/lib/supabase/admin"
import {
  processCompanyContactRefreshQueue,
  queueStaleCompanyContactRefresh,
} from "@/lib/growth/contact-discovery/company-contact-repository"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"

export const runtime = "nodejs"

const CRON_ROUTE = growthCronApiPath("growth-contact-refresh")

export async function POST(request: Request) {
  const admin = createServiceRoleClient()
  return runGrowthCronJob(
    { cronRoute: CRON_ROUTE, category: "intelligence", request, admin, enforceProductionSafety: false },
    async () => {
      const queued = await queueStaleCompanyContactRefresh(admin, 50)
      const result = await processCompanyContactRefreshQueue(admin, 25)
      return { queued, ...result }
    },
  )
}
