import { createServiceRoleClient } from "@/lib/supabase/admin"
import { runOutboundQueueHealthAlertScan } from "@/lib/growth/operations/outbound-queue-health-alerts"
import { runDueScheduledOutreachExecutions } from "@/lib/growth/outreach/run-outreach-queue"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"

export const runtime = "nodejs"

const CRON_ROUTE = growthCronApiPath("growth-outreach-execute")

export async function POST(request: Request) {
  const admin = createServiceRoleClient()
  return runGrowthCronJob(
    { cronRoute: CRON_ROUTE, category: "outbound", request, admin },
    async () => {
      const execution = await runDueScheduledOutreachExecutions(admin, {
        actingUserId: "system",
        actingUserEmail: "cron@growth.equipify.internal",
        limit: 25,
      })
      const alerts = await runOutboundQueueHealthAlertScan(admin).catch(() => ({
        alerts: [],
        emitted: 0,
      }))
      return { ...execution, alerts_emitted: alerts.emitted }
    },
    (result) => ({
      processedCount: result.executed,
      failedCount: result.failed,
      metadata: { alerts_emitted: result.alerts_emitted },
    }),
  )
}

/** Vercel Cron invokes scheduled routes with GET. */
export async function GET(request: Request) {
  return POST(request)
}
