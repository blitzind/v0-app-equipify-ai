import { createServiceRoleClient } from "@/lib/supabase/admin"
import { recoverStuckSequenceJobs } from "@/lib/growth/outbound/sequence-execution-hardening"
import { diagnoseSequenceWaitRecovery } from "@/lib/growth/sequences/conditions/sequence-wait-recovery-diagnostics"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"

export const runtime = "nodejs"

const CRON_ROUTE = growthCronApiPath("growth-sequence-recovery")

export async function POST(request: Request) {
  const admin = createServiceRoleClient()
  return runGrowthCronJob(
    { cronRoute: CRON_ROUTE, category: "outbound", request, admin },
    async () => {
      const [summary, waitRecovery] = await Promise.all([
        recoverStuckSequenceJobs(admin, { actorUserId: "system" }),
        diagnoseSequenceWaitRecovery(admin, { limit: 100 }),
      ])
      return { summary, waitRecovery }
    },
    (result) => ({
      metadata: { summary: result.summary, waitRecovery: result.waitRecovery },
    }),
  )
}

/** Vercel Cron invokes scheduled routes with GET. */
export async function GET(request: Request) {
  return POST(request)
}
