/**
 * Phase 7.PS-HS — Prospect graph expansion engine certification.
 * Run: pnpm test:growth-prospect-graph-expansion-cert-7-ps-hs
 */
import { createClient } from "@supabase/supabase-js"
import { evaluateProspectGraphExpansionCertification } from "../lib/growth/graph-expansion/prospect-graph-expansion-certification"
import {
  GROWTH_PROSPECT_SOURCE_REGISTRY,
  listLiveProspectSources,
} from "../lib/growth/graph-expansion/prospect-source-registry"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import type { GrowthProspectSearchCompanyResult } from "../lib/growth/prospect-search/prospect-search-types"

export const GROWTH_PROSPECT_GRAPH_EXPANSION_CERT_7_PS_HS_QA_MARKER =
  "growth-prospect-graph-expansion-cert-7-ps-hs-v1" as const

const PS_HE_ANCHORS = [
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

function shellFromAnchor(
  anchor: (typeof PS_HE_ANCHORS)[number],
): GrowthProspectSearchCompanyResult {
  return {
    id: anchor.company_candidate_id,
    source_type: "external_discovered",
    company_name: anchor.company_name,
    website: null,
    domain: null,
    canonical_company_id: anchor.canonical_company_id,
    growth_lead_id: null,
    is_suppressed: false,
    suppression_reason: null,
    suppression_scope: null,
    suppressed_at: null,
    lead_score: null,
    lead_engine_score: null,
    company_match_confidence: null,
    growth_signal_score: null,
    decision_maker_coverage: null,
    in_lead_inbox: false,
    existing_prospect: false,
    existing_customer: false,
    already_pushed: false,
    signals: [],
    match_reasoning: [],
    keywords: [],
    territory_match_reasons: [],
    score_explanation_items: [],
    confidence_explanation_items: [],
    contact_intelligence: null,
    reachable_human: null,
  } as GrowthProspectSearchCompanyResult
}

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const [
    { runProspectGraphExpansionCycle },
    { loadProspectGraphExpansionMetrics },
    { refreshProspectSearchCompanyAfterHumanAcquisition },
    { buildProspectSearchGraphExpansionOverlay },
    { GROWTH_PROSPECT_GRAPH_EXPANSION_QA_MARKER },
    { GROWTH_PROSPECT_SOURCE_TYPES },
  ] = await Promise.all([
    import("../lib/growth/graph-expansion/prospect-graph-expansion-orchestrator"),
    import("../lib/growth/graph-expansion/prospect-graph-expansion-metrics"),
    import("../lib/growth/prospect-search/prospect-search-human-acquisition-hydration"),
    import("../lib/growth/prospect-search/prospect-search-graph-expansion"),
    import("../lib/growth/graph-expansion/prospect-graph-expansion-types"),
    import("../lib/growth/graph-expansion/prospect-source-registry"),
  ])

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const compliance = evaluateProspectGraphExpansionCertification()
  const registry = listLiveProspectSources()

  const industry_before = await loadProspectGraphExpansionMetrics(admin, {
    industry_contains: "biomedical",
    limit: 200,
  })

  const anchor_ids = PS_HE_ANCHORS.map((a) => a.canonical_company_id)
  const anchor_before = await loadProspectGraphExpansionMetrics(admin, {
    company_ids: anchor_ids,
  })

  const cycle = await runProspectGraphExpansionCycle(admin, {
    anchor_companies: [...PS_HE_ANCHORS],
    industry_contains: "biomedical",
    queue_jobs: true,
    direct_anchor_acquisition: true,
    process_queue_limit: 16,
  })

  const industry_after = await loadProspectGraphExpansionMetrics(admin, {
    industry_contains: "biomedical",
    limit: 200,
  })

  const anchor_after = await loadProspectGraphExpansionMetrics(admin, {
    company_ids: anchor_ids,
  })

  const prospect_search_integration = []
  for (const anchor of PS_HE_ANCHORS) {
    const hydrated = await refreshProspectSearchCompanyAfterHumanAcquisition(admin, {
      company: shellFromAnchor(anchor),
      canonical_company_id: anchor.canonical_company_id,
      query: anchor.search_query,
    })
    const graph = hydrated.contact_intelligence?.graph_expansion ?? null
    prospect_search_integration.push({
      company: anchor.company_name,
      graph_qa_marker: graph?.qa_marker ?? null,
      graph_growth_score: graph?.graph_growth_score ?? 0,
      source_attribution: graph?.source_attribution_summary ?? [],
      evidence_freshness: graph?.evidence_freshness_label ?? null,
      named_person_density_pct: graph?.metrics.named_person_density_pct ?? 0,
      committee_density_pct: graph?.metrics.committee_density_pct ?? 0,
    })
  }

  const materialization = cycle.materialization
  const materialization_companies_added = materialization?.companies_added ?? 0
  const materialization_promoted = materialization?.candidates_promoted ?? 0

  const graph_size_increased =
    industry_after.metrics.companies_total > industry_before.metrics.companies_total ||
    anchor_after.metrics.persons_total > anchor_before.metrics.persons_total ||
    anchor_after.metrics.companies_total > anchor_before.metrics.companies_total ||
    materialization_companies_added > 0

  const density_increased =
    anchor_after.metrics.named_person_density_pct > anchor_before.metrics.named_person_density_pct ||
    industry_after.metrics.named_person_density_pct > industry_before.metrics.named_person_density_pct

  const graph_growth_without_density_loss =
    anchor_after.metrics.named_person_density_pct >= anchor_before.metrics.named_person_density_pct &&
    industry_after.metrics.named_person_density_pct >= industry_before.metrics.named_person_density_pct

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"

  if (
    materialization_promoted > 0 &&
    materialization_companies_added > 0 &&
    graph_growth_without_density_loss &&
    compliance.evidence_backed_only &&
    compliance.no_synthetic_contacts
  ) {
    certification = "PASS"
  } else if (
    graph_size_increased &&
    density_increased &&
    graph_growth_without_density_loss &&
    compliance.evidence_backed_only &&
    compliance.no_synthetic_contacts
  ) {
    certification = "PASS"
  } else if (
    cycle.jobs_processed > 0 &&
    graph_growth_without_density_loss &&
    (graph_size_increased ||
      cycle.evidence_versions_created > 0 ||
      cycle.discovery_new_companies > 0 ||
      materialization_promoted > 0)
  ) {
    certification = "PASS_PARTIAL"
  } else if (cycle.jobs_failed > 0 && cycle.jobs_processed === 0) {
    certification = "FAIL"
  } else if (graph_growth_without_density_loss && cycle.evidence_versions_created > 0) {
    certification = "PASS_PARTIAL"
  }

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_PROSPECT_GRAPH_EXPANSION_CERT_7_PS_HS_QA_MARKER,
        certification,
        compliance,
        source_registry: {
          qa_marker: "growth-prospect-source-registry-7-ps-hs-v1",
          live_sources: registry.length,
          source_types: GROWTH_PROSPECT_SOURCE_TYPES,
          entries: GROWTH_PROSPECT_SOURCE_REGISTRY.map((e) => ({
            source_type: e.source_type,
            refresh_cadence_days: e.refresh_cadence_days,
            live: e.live,
          })),
        },
        graph_expansion_cycle: {
          qa_marker: GROWTH_PROSPECT_GRAPH_EXPANSION_QA_MARKER,
          ok: cycle.ok,
          jobs_queued: cycle.jobs_queued,
          jobs_processed: cycle.jobs_processed,
          jobs_failed: cycle.jobs_failed,
          discovery_new_companies: cycle.discovery_new_companies,
          evidence_versions_created: cycle.evidence_versions_created,
          materialization,
          messages: cycle.messages.slice(0, 8),
        },
        companies_added: {
          industry: industry_after.metrics.companies_total - industry_before.metrics.companies_total,
          anchors: anchor_after.metrics.companies_total - anchor_before.metrics.companies_total,
          discovery_new_companies: cycle.discovery_new_companies,
          materialization: materialization_companies_added,
          candidates_promoted: materialization_promoted,
        },
        persons_added: anchor_after.metrics.persons_total - anchor_before.metrics.persons_total,
        named_person_density: {
          before: anchor_before.metrics.named_person_density_pct,
          after: anchor_after.metrics.named_person_density_pct,
          industry_before: industry_before.metrics.named_person_density_pct,
          industry_after: industry_after.metrics.named_person_density_pct,
        },
        committee_density: {
          before: anchor_before.metrics.committee_density_pct,
          after: anchor_after.metrics.committee_density_pct,
          members_added:
            anchor_after.metrics.committee_members_verified -
            anchor_before.metrics.committee_members_verified,
        },
        graph_growth_metrics: {
          anchors_before: anchor_before.metrics,
          anchors_after: anchor_after.metrics,
          anchors_delta: cycle.metrics_delta,
          industry_before: industry_before.metrics,
          industry_after: industry_after.metrics,
        },
        verified_channels_delta: {
          emails:
            anchor_after.metrics.verified_emails_total - anchor_before.metrics.verified_emails_total,
          phones:
            anchor_after.metrics.verified_phones_total - anchor_before.metrics.verified_phones_total,
          profiles:
            anchor_after.metrics.verified_profiles_total -
            anchor_before.metrics.verified_profiles_total,
        },
        outreach_ready_estimate: cycle.outreach_ready_estimate,
        prospect_search_integration,
        remaining_blockers: [
          ...(density_increased ? [] : ["named_person_density_not_increased"]),
          ...(graph_size_increased ? [] : ["graph_size_not_increased_on_anchors_or_industry"]),
          ...(materialization_promoted === 0
            ? ["discovery_candidates_not_materialized_to_canonical_graph"]
            : []),
          ...(cycle.discovery_new_companies === 0
            ? ["discovery_segments_returned_zero_new_companies"]
            : []),
          ...(anchor_after.metrics.committee_members_verified === 0
            ? ["committee_density_still_zero"]
            : []),
          ...(materialization?.promotion_blockers ?? []),
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
