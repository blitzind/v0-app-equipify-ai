import { createServiceRoleClient } from "@/lib/supabase/admin"
import { runGrowthPdlTestLookup } from "@/lib/growth/contact-discovery/contact-discovery-provider-health-repository"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"
import { GROWTH_PDL_RUNTIME_VALIDATION_QA_MARKER } from "@/lib/growth/qa/pdl-runtime-validation-types"
import { PDL_RUNTIME_VALIDATION_PROBE_COMPANY } from "@/lib/growth/qa/pdl-runtime-validation-audit"
import { buildGrowthProviderRuntimeDiagnosticsSnapshot } from "@/lib/growth/qa/growth-provider-runtime-diagnostics"

export const runtime = "nodejs"
export const maxDuration = 60

const CRON_ROUTE = growthCronApiPath("growth-pdl-test-lookup-run")

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
      const diagnostics = buildGrowthProviderRuntimeDiagnosticsSnapshot(process.env)
      const lookup = await runGrowthPdlTestLookup({
        company_name: PDL_RUNTIME_VALIDATION_PROBE_COMPANY.company_name,
        domain: PDL_RUNTIME_VALIDATION_PROBE_COMPANY.domain,
        limit: 3,
        sandbox: false,
      })

      return {
        qa_marker: GROWTH_PDL_RUNTIME_VALIDATION_QA_MARKER,
        probe_company: PDL_RUNTIME_VALIDATION_PROBE_COMPANY,
        diagnostics,
        lookup,
        processed: 1,
      }
    },
    (result) => ({
      processedCount: 1,
      metadata: {
        qa_marker: result.qa_marker,
        probe_company: result.probe_company,
        diagnostics: result.diagnostics,
        lookup: result.lookup,
      },
    }),
  )
}

export async function GET(request: Request) {
  return POST(request)
}
