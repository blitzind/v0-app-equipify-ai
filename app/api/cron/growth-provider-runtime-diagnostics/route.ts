import { createServiceRoleClient } from "@/lib/supabase/admin"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { guardGrowthFeatureCronJob } from "@/lib/growth/runtime/growth-feature-api-guards"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"
import {
  buildGrowthProviderRuntimeDiagnosticsSnapshot,
  GROWTH_PROVIDER_RUNTIME_DIAGNOSTICS_QA_MARKER,
} from "@/lib/growth/qa/growth-provider-runtime-diagnostics"

export const runtime = "nodejs"
export const maxDuration = 60

const CRON_ROUTE = growthCronApiPath("growth-provider-runtime-diagnostics")

export async function POST(request: Request) {
  const coldCron = guardGrowthFeatureCronJob("diagnosticsDashboards")
  if (coldCron) return coldCron

  const admin = createServiceRoleClient()
  return runGrowthCronJob(
    {
      cronRoute: CRON_ROUTE,
      category: "discovery",
      request,
      admin,
      enforceProductionSafety: false,
    },
    async () => {
      const diagnostics = buildGrowthProviderRuntimeDiagnosticsSnapshot(process.env)
      return {
        qa_marker: GROWTH_PROVIDER_RUNTIME_DIAGNOSTICS_QA_MARKER,
        diagnostics,
        processed: 1,
      }
    },
    (result) => ({
      processedCount: 1,
      metadata: {
        qa_marker: result.qa_marker,
        diagnostics: result.diagnostics,
      },
    }),
  )
}

export async function GET(request: Request) {
  return POST(request)
}
