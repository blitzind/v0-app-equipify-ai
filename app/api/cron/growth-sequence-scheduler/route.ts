import { createServiceRoleClient } from "@/lib/supabase/admin"
import { runGrowthSequenceScheduler } from "@/lib/growth/sequence-enrollment/run-sequence-scheduler"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"

export const runtime = "nodejs"

const CRON_ROUTE = growthCronApiPath("growth-sequence-scheduler")

export async function POST(request: Request) {
  const admin = createServiceRoleClient()
  return runGrowthCronJob(
    { cronRoute: CRON_ROUTE, category: "outbound", request, admin },
    () =>
      runGrowthSequenceScheduler(admin, {
        actingUserId: "system",
        actingUserEmail: "cron@growth.equipify.internal",
        limit: 25,
        dryRun: false,
      }),
  )
}
