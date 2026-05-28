import { createServiceRoleClient } from "@/lib/supabase/admin"
import { runGrowthReputationSnapshotRollup } from "@/lib/growth/deliverability/reputation-snapshot-runner"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"

export const runtime = "nodejs"

const CRON_ROUTE = growthCronApiPath("growth-reputation-snapshot")

export async function POST(request: Request) {
  const admin = createServiceRoleClient()
  return runGrowthCronJob(
    { cronRoute: CRON_ROUTE, category: "outbound", request, admin },
    async () => runGrowthReputationSnapshotRollup(admin),
    (result) => ({
      processedCount: result.assessed_count,
      metadata: {
        snapshot_date: result.snapshot_date,
        alerts_emitted: result.alerts_emitted,
        pauses_persisted: result.pauses_persisted,
        recoveries_recorded: result.recoveries_recorded,
        qa_marker: result.qa_marker,
      },
    }),
  )
}
