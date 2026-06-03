import { createServiceRoleClient } from "@/lib/supabase/admin"
import { runDeliverabilityIntelligenceScan } from "@/lib/growth/deliverability/deliverability-intelligence-runner"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"

export const runtime = "nodejs"

const CRON_ROUTE = growthCronApiPath("growth-dns-verify")

export async function POST(request: Request) {
  const admin = createServiceRoleClient()
  return runGrowthCronJob(
    { cronRoute: CRON_ROUTE, category: "outbound", request, admin },
    async () => {
      const summary = await runDeliverabilityIntelligenceScan(admin)
      return { summary }
    },
    (result) => ({ metadata: { summary: result.summary } }),
  )
}

/** Vercel Cron invokes scheduled routes with GET. */
export async function GET(request: Request) {
  return POST(request)
}
