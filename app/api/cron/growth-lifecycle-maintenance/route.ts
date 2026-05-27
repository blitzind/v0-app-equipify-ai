import { createServiceRoleClient } from "@/lib/supabase/admin"
import { runLifecycleOpsMaintenanceScan } from "@/lib/growth/outbound/lifecycle-ops-runner"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"

export const runtime = "nodejs"

const CRON_ROUTE = growthCronApiPath("growth-lifecycle-maintenance")

export async function POST(request: Request) {
  const admin = createServiceRoleClient()
  return runGrowthCronJob(
    { cronRoute: CRON_ROUTE, category: "outbound", request, admin },
    async () => {
      const summary = await runLifecycleOpsMaintenanceScan(admin)
      return { summary }
    },
    (result) => ({ metadata: { summary: result.summary } }),
  )
}
