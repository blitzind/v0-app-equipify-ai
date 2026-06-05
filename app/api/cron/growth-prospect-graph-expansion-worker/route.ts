import { createServiceRoleClient } from "@/lib/supabase/admin"
import { runProspectGraphExpansionCycle } from "@/lib/growth/graph-expansion/prospect-graph-expansion-orchestrator"
import { GROWTH_PROSPECT_GRAPH_EXPANSION_SEGMENTS } from "@/lib/growth/graph-expansion/prospect-continuous-acquisition"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"

export const runtime = "nodejs"

const CRON_ROUTE = growthCronApiPath("growth-prospect-graph-expansion-worker")

/** Default biomedical ICP anchors for nightly graph expansion. */
const DEFAULT_GRAPH_ANCHORS = [
  {
    company_candidate_id: "94bea025-d2df-4a13-ba6c-ec1476b6d050",
    canonical_company_id: "3620d561-8568-4104-a878-898bfec618ca",
    company_name: "Emergency Repair Biomedical",
    search_query: "biomedical equipment service companies",
  },
  {
    company_candidate_id: "5ee5a006-6eb8-4890-8775-21d22af4af6e",
    canonical_company_id: "4456d3c3-900a-468f-ac33-aadabac67e52",
    company_name: "Biomedical Repair Service",
    search_query: "medical equipment repair companies",
  },
  {
    company_candidate_id: "5a9a8ba4-1f8b-4ec6-9ebf-5607bbadf1ec",
    canonical_company_id: "dcf0c09b-c636-4f82-b511-2af45076630e",
    company_name: "ERS Biomedical Services",
    search_query: "biomedical equipment service companies",
  },
] as const

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
      const result = await runProspectGraphExpansionCycle(admin, {
        anchor_companies: [...DEFAULT_GRAPH_ANCHORS],
        industry_contains: "biomedical",
        queue_jobs: true,
        direct_anchor_acquisition: false,
        process_queue_limit: 14,
      })
      return {
        ok: result.ok,
        jobs_queued: result.jobs_queued,
        jobs_processed: result.jobs_processed,
        discovery_new_companies: result.discovery_new_companies,
        evidence_versions_created: result.evidence_versions_created,
        metrics_delta: result.metrics_delta,
        segments: GROWTH_PROSPECT_GRAPH_EXPANSION_SEGMENTS.map((s) => s.key),
        outreach_ready_delta: result.outreach_ready_estimate.delta,
      }
    },
  )
}

/** Vercel Cron invokes scheduled routes with GET. */
export async function GET(request: Request) {
  return POST(request)
}
