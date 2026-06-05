/**
 * Phase 7.PS-HT — Canonical graph materialization certification.
 * Run: pnpm test:growth-canonical-graph-materialization-cert-7-ps-ht
 */
import { createClient } from "@supabase/supabase-js"
import { evaluateCanonicalGraphMaterializationCertification } from "../lib/growth/graph-expansion/canonical-graph-materialization-certification"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_CANONICAL_GRAPH_MATERIALIZATION_CERT_7_PS_HT_QA_MARKER =
  "growth-canonical-graph-materialization-cert-7-ps-ht-v1" as const

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const [
    { runCanonicalGraphMaterialization },
    { loadProspectGraphExpansionMetrics },
    { diffProspectGraphExpansionMetrics },
    { runProspectGraphExpansionCycle },
    { GROWTH_CANONICAL_GRAPH_MATERIALIZATION_QA_MARKER },
  ] = await Promise.all([
    import("../lib/growth/graph-expansion/canonical-graph-materialization"),
    import("../lib/growth/graph-expansion/prospect-graph-expansion-metrics"),
    import("../lib/growth/graph-expansion/prospect-graph-expansion-metrics"),
    import("../lib/growth/graph-expansion/prospect-graph-expansion-orchestrator"),
    import("../lib/growth/graph-expansion/canonical-graph-materialization-types"),
  ])

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const compliance = evaluateCanonicalGraphMaterializationCertification()

  const industry_before = await loadProspectGraphExpansionMetrics(admin, {
    industry_contains: "biomedical",
    limit: 500,
  })

  const { count: unlinked_before } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .select("id", { count: "exact", head: true })
    .is("canonical_company_id", null)

  const materialization = await runCanonicalGraphMaterialization(admin, {
    mode: "apply",
    industry_contains: "biomedical",
    limit: 120,
    run_person_backfill: true,
  })

  const industry_after = await loadProspectGraphExpansionMetrics(admin, {
    industry_contains: "biomedical",
    limit: 500,
  })

  const { count: unlinked_after } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .select("id", { count: "exact", head: true })
    .is("canonical_company_id", null)

  const metrics_delta = diffProspectGraphExpansionMetrics(
    industry_before.metrics,
    industry_after.metrics,
  )

  const anchors = [
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

  const hs_cycle = await runProspectGraphExpansionCycle(admin, {
    anchor_companies: [...anchors],
    industry_contains: "biomedical",
    queue_jobs: false,
    direct_anchor_acquisition: false,
    process_queue_limit: 0,
  })

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"
  const companies_promoted = materialization.metrics.candidates_promoted
  const companies_added = materialization.metrics.companies_added
  const canonical_growth = industry_after.metrics.companies_total - industry_before.metrics.companies_total
  const density_ok =
    industry_after.metrics.named_person_density_pct >= industry_before.metrics.named_person_density_pct

  if (
    companies_promoted > 0 &&
    (companies_added > 0 || canonical_growth > 0) &&
    density_ok &&
    compliance.evidence_backed_only &&
    compliance.no_threshold_lowering
  ) {
    certification = "PASS"
  } else if (materialization.metrics.candidates_promoted > 0 && density_ok) {
    certification = "PASS_PARTIAL"
  } else if (materialization.metrics.candidates_eligible > 0 && materialization.ok) {
    certification = "PASS_PARTIAL"
  }

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_CANONICAL_GRAPH_MATERIALIZATION_CERT_7_PS_HT_QA_MARKER,
        certification,
        compliance,
        materialization: {
          qa_marker: GROWTH_CANONICAL_GRAPH_MATERIALIZATION_QA_MARKER,
          ok: materialization.ok,
          metrics: materialization.metrics,
          promoted_companies: materialization.promoted_companies.slice(0, 15),
          blocked_samples: materialization.blocked_samples.slice(0, 10),
          messages: materialization.messages,
        },
        companies_discovered: materialization.metrics.candidates_discovered,
        companies_promoted,
        persons_promoted: materialization.metrics.persons_promoted,
        canonical_graph_growth: {
          companies_before: industry_before.metrics.companies_total,
          companies_after: industry_after.metrics.companies_total,
          companies_delta: canonical_growth,
          persons_delta: metrics_delta.persons_total ?? 0,
          unlinked_discovery_candidates: {
            before: unlinked_before ?? 0,
            after: unlinked_after ?? 0,
          },
        },
        named_person_density: {
          before: industry_before.metrics.named_person_density_pct,
          after: industry_after.metrics.named_person_density_pct,
        },
        committee_density: {
          before: industry_before.metrics.committee_density_pct,
          after: industry_after.metrics.committee_density_pct,
        },
        outreach_ready_estimate: hs_cycle.outreach_ready_estimate,
        ps_hs_rerun: {
          ok: hs_cycle.ok,
          materialization: hs_cycle.materialization,
          metrics_delta: hs_cycle.metrics_delta,
          outreach_ready_estimate: hs_cycle.outreach_ready_estimate,
        },
        remaining_blockers: [
          ...(companies_promoted === 0 ? ["no_candidates_promoted"] : []),
          ...(companies_added === 0 && canonical_growth === 0
            ? ["canonical_companies_total_unchanged"]
            : []),
          ...(industry_after.metrics.committee_members_verified === 0
            ? ["committee_density_still_zero"]
            : []),
        ],
      },
      null,
      2,
    ),
  )

  if (certification === "FAIL") process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
