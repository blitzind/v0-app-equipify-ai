import { createServiceRoleClient } from "@/lib/supabase/admin"
import { processCompanyIntelligenceJobQueue } from "@/lib/growth/company-intelligence/company-intelligence-queue"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"

export const runtime = "nodejs"
export const maxDuration = 300

const CRON_ROUTE = growthCronApiPath("growth-company-intelligence-worker")

export async function POST(request: Request) {
  const admin = createServiceRoleClient()
  return runGrowthCronJob(
    { cronRoute: CRON_ROUTE, category: "discovery", request, admin, enforceProductionSafety: false },
    async () => processCompanyIntelligenceJobQueue(admin),
  )
}

export async function GET(request: Request) {
  return POST(request)
}
