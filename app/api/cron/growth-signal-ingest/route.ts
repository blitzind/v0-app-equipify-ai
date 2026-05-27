import { createServiceRoleClient } from "@/lib/supabase/admin"
import { processSignalIngestionQueue } from "@/lib/growth/signals/signal-ingestion-worker"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"

export const runtime = "nodejs"

const CRON_ROUTE = growthCronApiPath("growth-signal-ingest")

export async function POST(request: Request) {
  const admin = createServiceRoleClient()
  return runGrowthCronJob(
    { cronRoute: CRON_ROUTE, category: "intelligence", request, admin, enforceProductionSafety: false },
    () => processSignalIngestionQueue(admin, 25),
  )
}
