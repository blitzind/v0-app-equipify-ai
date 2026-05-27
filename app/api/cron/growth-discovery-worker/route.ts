import { createServiceRoleClient } from "@/lib/supabase/admin"
import {
  processDiscoveryRefreshQueue,
  queueNightlyDiscoverySegments,
} from "@/lib/growth/discovery-engine/discovery-repository"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"

export const runtime = "nodejs"

const CRON_ROUTE = growthCronApiPath("growth-discovery-worker")

export async function POST(request: Request) {
  const admin = createServiceRoleClient()
  return runGrowthCronJob(
    { cronRoute: CRON_ROUTE, category: "discovery", request, admin, enforceProductionSafety: false },
    async () => {
      const queued = await queueNightlyDiscoverySegments(admin)
      const result = await processDiscoveryRefreshQueue(admin, 7)
      return { queued, ...result }
    },
  )
}
