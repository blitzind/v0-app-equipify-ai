import { createServiceRoleClient } from "@/lib/supabase/admin"
import { runDueScheduledOutreachExecutions } from "@/lib/growth/outreach/run-outreach-queue"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"

export const runtime = "nodejs"

const CRON_ROUTE = growthCronApiPath("growth-outreach-execute")

export async function POST(request: Request) {
  const admin = createServiceRoleClient()
  return runGrowthCronJob(
    { cronRoute: CRON_ROUTE, category: "outbound", request, admin },
    () =>
      runDueScheduledOutreachExecutions(admin, {
        actingUserId: "system",
        actingUserEmail: "cron@growth.equipify.internal",
        limit: 25,
      }),
    (result) => ({ processedCount: result.executed, failedCount: result.failed }),
  )
}
