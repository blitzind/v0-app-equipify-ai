import { createServiceRoleClient } from "@/lib/supabase/admin"
import { runInboxSyncForEnabledMailboxes } from "@/lib/growth/inbox-sync/inbox-sync-runner"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"

export const runtime = "nodejs"

const CRON_ROUTE = growthCronApiPath("growth-inbox-sync")

export async function POST(request: Request) {
  const admin = createServiceRoleClient()
  return runGrowthCronJob(
    { cronRoute: CRON_ROUTE, category: "inbox", request, admin },
    async () => {
      const summary = await runInboxSyncForEnabledMailboxes(admin, {
        actingUserId: "system",
        actorEmail: "cron@growth.equipify.internal",
        limit: 10,
      })
      return { summary }
    },
    (result) => ({ metadata: { summary: result.summary } }),
  )
}
