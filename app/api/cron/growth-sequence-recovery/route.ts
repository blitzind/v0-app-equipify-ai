import { createServiceRoleClient } from "@/lib/supabase/admin"
import { recoverStuckSequenceJobs } from "@/lib/growth/outbound/sequence-execution-hardening"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"

export const runtime = "nodejs"

const CRON_ROUTE = growthCronApiPath("growth-sequence-recovery")

export async function POST(request: Request) {
  const admin = createServiceRoleClient()
  return runGrowthCronJob(
    { cronRoute: CRON_ROUTE, category: "outbound", request, admin },
    async () => {
      const summary = await recoverStuckSequenceJobs(admin, { actorUserId: "system" })
      return { summary }
    },
    (result) => ({ metadata: { summary: result.summary } }),
  )
}

/** Vercel Cron invokes scheduled routes with GET. */
export async function GET(request: Request) {
  return POST(request)
}
