import { createServiceRoleClient } from "@/lib/supabase/admin"
import { runApolloReplacementBenchmarkPdlValidation } from "@/lib/growth/benchmark/apollo-replacement-benchmark-pdl-validation-discovery"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"
import { GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PDL_VALIDATION_QA_MARKER } from "@/lib/growth/benchmark/apollo-replacement-benchmark-pdl-validation-types"

export const runtime = "nodejs"
export const maxDuration = 300

const CRON_ROUTE = growthCronApiPath("growth-pdl-benchmark-validation-run")

export async function POST(request: Request) {
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
      const validation = await runApolloReplacementBenchmarkPdlValidation(admin)
      return {
        qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PDL_VALIDATION_QA_MARKER,
        validation,
        processed: validation.metrics.companies_processed,
      }
    },
    (result) => ({
      processedCount: result.processed,
      metadata: {
        qa_marker: result.qa_marker,
        validation_result: result.validation,
      },
    }),
  )
}

export async function GET(request: Request) {
  return POST(request)
}
