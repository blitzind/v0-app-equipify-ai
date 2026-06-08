import { createServiceRoleClient } from "@/lib/supabase/admin"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"
import { GROWTH_PDL_RUNTIME_COVERAGE_AUDIT_QA_MARKER } from "@/lib/growth/qa/pdl-runtime-coverage-audit"
import { runPdlRuntimeCoverageAuditOnRuntime } from "@/lib/growth/qa/pdl-runtime-coverage-audit"

export const runtime = "nodejs"
export const maxDuration = 120

const CRON_ROUTE = growthCronApiPath("growth-pdl-coverage-audit-run")

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
      const audit = await runPdlRuntimeCoverageAuditOnRuntime(admin, { max_companies: 10 })
      return {
        qa_marker: GROWTH_PDL_RUNTIME_COVERAGE_AUDIT_QA_MARKER,
        audit_result: audit,
        processed: audit.companies_probed,
      }
    },
    (result) => ({
      processedCount: result.processed,
      metadata: {
        qa_marker: result.qa_marker,
        audit_result: result.audit_result,
      },
    }),
  )
}

export async function GET(request: Request) {
  return POST(request)
}
