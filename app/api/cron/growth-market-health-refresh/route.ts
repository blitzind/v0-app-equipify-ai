import { createServiceRoleClient } from "@/lib/supabase/admin"
import {
  processMarketHealthRefreshQueue,
  queueMarketHealthRefresh,
  rebuildDiscoveryOutcomePatterns,
} from "@/lib/growth/market-intelligence/market-repository"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"

export const runtime = "nodejs"

const CRON_ROUTE = growthCronApiPath("growth-market-health-refresh")

export async function POST(request: Request) {
  const admin = createServiceRoleClient()
  return runGrowthCronJob(
    { cronRoute: CRON_ROUTE, category: "intelligence", request, admin, enforceProductionSafety: false },
    async () => {
      const queued = await queueMarketHealthRefresh(admin)
      const patterns = await rebuildDiscoveryOutcomePatterns(admin)
      const result = await processMarketHealthRefreshQueue(admin, 10)
      return { queued, patterns_rebuilt: patterns, ...result }
    },
  )
}

/** Vercel Cron invokes scheduled routes with GET. */
export async function GET(request: Request) {
  return POST(request)
}
