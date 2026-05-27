import { createServiceRoleClient } from "@/lib/supabase/admin"
import { runApprovedDueSequenceExecutionJobs } from "@/lib/growth/sequences/execution/sequence-job-runner"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"

export const runtime = "nodejs"

const CRON_ROUTE = growthCronApiPath("growth-sequence-safe-execute")

export async function POST(request: Request) {
  const admin = createServiceRoleClient()
  return runGrowthCronJob(
    { cronRoute: CRON_ROUTE, category: "outbound", request, admin },
    async () => {
      const summary = await runApprovedDueSequenceExecutionJobs(admin, {
        actingUserId: "system",
        actingUserEmail: "cron@growth.equipify.internal",
        limit: 25,
      })
      return { summary }
    },
    (result) => ({
      processedCount: (result.summary as { executed?: number }).executed,
      failedCount: (result.summary as { failed?: number }).failed,
      metadata: { summary: result.summary },
    }),
  )
}
