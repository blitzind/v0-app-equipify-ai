/**
 * Phase 7.PS-HP — Buying committee intelligence foundation certification.
 * Run: pnpm test:growth-buying-committee-intelligence-cert-7-ps-hp
 */
import { createClient } from "@supabase/supabase-js"
import { evaluateBuyingCommitteeIntelligenceCertification } from "../lib/growth/buying-committee-intelligence/buying-committee-intelligence-certification"
import { collectAllBuyingCommitteeIntelligenceAssignments } from "../lib/growth/buying-committee-intelligence/buying-committee-intelligence-sources"
import { loadBuyingCommitteeIntelligenceContext } from "../lib/growth/buying-committee-intelligence/buying-committee-intelligence-sources"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  ensureBuyingCommitteeIntelligenceFoundation,
  GROWTH_PROSPECT_SEARCH_BUYING_COMMITTEE_FOUNDATION_QA_MARKER,
  loadBuyingCommitteeFoundationSnapshot,
} from "../lib/growth/prospect-search/prospect-search-buying-committee-foundation"
import type { GrowthProspectSearchCompanyResult } from "../lib/growth/prospect-search/prospect-search-types"

export const GROWTH_BUYING_COMMITTEE_INTELLIGENCE_CERT_7_PS_HP_QA_MARKER =
  "growth-buying-committee-intelligence-cert-7-ps-hp-v1" as const

const PS_HE_TARGETS = [
  {
    company_candidate_id: "94bea025-d2df-4a13-ba6c-ec1476b6d050",
    canonical_company_id: "3620d561-8568-4104-a878-898bfec618ca",
    person_id: "dd551823-7adc-4637-817f-4989a30f108e",
    company_name: "Emergency Repair Biomedical",
    query: "biomedical equipment service companies",
  },
  {
    company_candidate_id: "5ee5a006-6eb8-4890-8775-21d22af4af6e",
    canonical_company_id: "4456d3c3-900a-468f-ac33-aadabac67e52",
    person_id: "1e08ba6f-b820-497f-a0f8-19dca37887f7",
    company_name: "Biomedical Repair Service",
    query: "medical equipment repair companies",
  },
  {
    company_candidate_id: "5a9a8ba4-1f8b-4ec6-9ebf-5607bbadf1ec",
    canonical_company_id: "dcf0c09b-c636-4f82-b511-2af45076630e",
    person_id: "ece67a39-e12e-4dc7-8c51-99274e0b13b4",
    company_name: "ERS Biomedical Services",
    query: "biomedical equipment service companies",
  },
] as const

function shellFromTarget(
  target: (typeof PS_HE_TARGETS)[number],
): GrowthProspectSearchCompanyResult {
  return {
    id: target.company_candidate_id,
    source_type: "external_discovered",
    company_name: target.company_name,
    website: null,
    domain: null,
    canonical_company_id: target.canonical_company_id,
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

async function countOutreachReady(
  admin: ReturnType<typeof createClient>,
  deps: {
    refreshProspectSearchCompanyAfterHumanAcquisition: typeof import("../lib/growth/prospect-search/prospect-search-human-acquisition-hydration").refreshProspectSearchCompanyAfterHumanAcquisition
    buildProspectSearchEngineReadiness: typeof import("../lib/growth/prospect-search/prospect-search-engine-readiness").buildProspectSearchEngineReadiness
    resolveProspectSearchOutreachReadinessGate: typeof import("../lib/growth/prospect-search/prospect-search-outreach-readiness-gate").resolveProspectSearchOutreachReadinessGate
    resolveProspectSearchReachableHumanScore: typeof import("../lib/growth/prospect-search/prospect-search-reachable-human-scoring").resolveProspectSearchReachableHumanScore
    buildProspectSearchAccountContactStrategy: typeof import("../lib/growth/prospect-search/prospect-search-account-contact-strategy").buildProspectSearchAccountContactStrategy
    buildProspectSearchCompanyContactCoverageIntelligence: typeof import("../lib/growth/prospect-search/prospect-search-company-contact-coverage-intelligence").buildProspectSearchCompanyContactCoverageIntelligence
    buildProspectSearchPeopleRowsFromCompanies: typeof import("../lib/growth/prospect-search/prospect-search-contact-discovery").buildProspectSearchPeopleRowsFromCompanies
  },
) {
  let outreach_ready_companies = 0
  let committee_verified_total = 0
  const per_company: Array<Record<string, unknown>> = []

  for (const target of PS_HE_TARGETS) {
    const hydrated = await deps.refreshProspectSearchCompanyAfterHumanAcquisition(admin, {
      company: shellFromTarget(target),
      canonical_company_id: target.canonical_company_id,
      query: target.query,
    })
    const reachable = deps.resolveProspectSearchReachableHumanScore(hydrated)
    const outreach_gate = deps.resolveProspectSearchOutreachReadinessGate({
      company: hydrated,
      reachable,
    })
    const engine_readiness = deps.buildProspectSearchEngineReadiness({ company: hydrated })
    const peopleRows = deps.buildProspectSearchPeopleRowsFromCompanies([hydrated])
    const coverageContacts = peopleRows.map((row) => ({
      contact_id: row.id,
      full_name: row.name,
      title: row.title,
      email_available: row.email_available,
      phone_available: row.phone_available,
      outreach_rank_score: row.outreach_rank_score ?? 0,
      priority_tier: row.priority_tier ?? "low_confidence",
      is_recommended_contact: row.is_recommended_contact ?? false,
      freshness_status: row.freshness_status ?? "fresh",
      email_eligibility: row.email_eligibility ?? "ineligible",
      call_eligibility: row.call_eligibility ?? "ineligible",
      sms_eligibility: row.sms_eligibility ?? "ineligible",
      verification_status: row.verification_status,
      confidence: row.confidence,
      role_type: row.persona?.role_type ?? null,
      ranking_reasons: row.ranking?.reasons ?? [],
    }))
    const coverage = deps.buildProspectSearchCompanyContactCoverageIntelligence({
      company_name: target.company_name,
      contacts: coverageContacts,
      company_suppressed: false,
    })
    const accountStrategy = deps.buildProspectSearchAccountContactStrategy({
      company_id: target.canonical_company_id,
      company_name: target.company_name,
      contacts: coverageContacts,
      coverage,
    })

    const committee = hydrated.contact_intelligence?.engine_intelligence?.buying_committee
    committee_verified_total += committee?.verified_member_count ?? 0

    const company_outreach_ready =
      outreach_gate.state === "ready" ||
      engine_readiness.prioritization_tier === "ready_for_outreach" ||
      accountStrategy.account_outreach_readiness === "ready"
    if (company_outreach_ready) outreach_ready_companies += 1

    per_company.push({
      company: target.company_name,
      outreach_ready: company_outreach_ready,
      committee_verified: committee?.verified_member_count ?? 0,
      committee_coverage_score: committee?.coverage_score ?? 0,
      committee_completeness: committee?.committee_completeness ?? 0,
      committee_readiness: committee?.committee_readiness ?? "blocked",
      missing_critical_roles: committee?.missing_critical_roles ?? [],
      detected_role_labels: committee?.detected_role_labels ?? [],
      prioritization_tier: engine_readiness.prioritization_tier,
      committee_score: engine_readiness.committee.score,
    })
  }

  return { outreach_ready_companies, committee_verified_total, per_company }
}

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const compliance = evaluateBuyingCommitteeIntelligenceCertification()

  const before_snapshots = await Promise.all(
    PS_HE_TARGETS.map((t) => loadBuyingCommitteeFoundationSnapshot(admin, t.canonical_company_id)),
  )
  const before_verified = before_snapshots.reduce((sum, s) => sum + s.members.length, 0)

  const [
    { refreshProspectSearchCompanyAfterHumanAcquisition },
    { buildProspectSearchEngineReadiness },
    { resolveProspectSearchOutreachReadinessGate },
    { resolveProspectSearchReachableHumanScore },
    { buildProspectSearchAccountContactStrategy },
    { buildProspectSearchCompanyContactCoverageIntelligence },
    { buildProspectSearchPeopleRowsFromCompanies },
  ] = await Promise.all([
    import("../lib/growth/prospect-search/prospect-search-human-acquisition-hydration"),
    import("../lib/growth/prospect-search/prospect-search-engine-readiness"),
    import("../lib/growth/prospect-search/prospect-search-outreach-readiness-gate"),
    import("../lib/growth/prospect-search/prospect-search-reachable-human-scoring"),
    import("../lib/growth/prospect-search/prospect-search-account-contact-strategy"),
    import("../lib/growth/prospect-search/prospect-search-company-contact-coverage-intelligence"),
    import("../lib/growth/prospect-search/prospect-search-contact-discovery"),
  ])

  const outreachDeps = {
    refreshProspectSearchCompanyAfterHumanAcquisition,
    buildProspectSearchEngineReadiness,
    resolveProspectSearchOutreachReadinessGate,
    resolveProspectSearchReachableHumanScore,
    buildProspectSearchAccountContactStrategy,
    buildProspectSearchCompanyContactCoverageIntelligence,
    buildProspectSearchPeopleRowsFromCompanies,
  }

  const before_outreach = await countOutreachReady(admin, outreachDeps)

  const candidate_discovery: Array<Record<string, unknown>> = []
  const foundation_runs: Array<Record<string, unknown>> = []

  for (const target of PS_HE_TARGETS) {
    const ctx = await loadBuyingCommitteeIntelligenceContext(admin, {
      company_id: target.canonical_company_id,
    })
    if (!ctx) continue
    const collected = await collectAllBuyingCommitteeIntelligenceAssignments(admin, ctx)
    candidate_discovery.push({
      company: target.company_name,
      draft_count: collected.drafts.length,
      sources: [...new Set(collected.drafts.map((d) => d.source))],
      messages: collected.messages,
      drafts: collected.drafts.map((d) => ({
        person_id: d.person_id,
        full_name: d.full_name,
        job_title: d.job_title,
        committee_role: d.committee_role,
        source: d.source,
        evidence_count: d.evidence.length,
      })),
    })

    const run = await ensureBuyingCommitteeIntelligenceFoundation(admin, {
      company_id: target.canonical_company_id,
      force: true,
    })
    foundation_runs.push({ company: target.company_name, ...run })
  }

  const after_snapshots = await Promise.all(
    PS_HE_TARGETS.map((t) => loadBuyingCommitteeFoundationSnapshot(admin, t.canonical_company_id)),
  )
  const after_verified = after_snapshots.reduce((sum, s) => sum + s.members.length, 0)
  const synthetic_risk = after_snapshots.reduce((sum, s) => sum + s.synthetic_risk_count, 0)

  const after_outreach = await countOutreachReady(admin, outreachDeps)

  const evidence_traceable = after_snapshots.every((snapshot) =>
    snapshot.members.every((m) => Boolean(m.person_id)),
  )
  const no_synthetic = synthetic_risk === 0
  const invented_person_ids = after_snapshots.some((snapshot) =>
    snapshot.members.some((m) => !m.person_id || m.full_name.toLowerCase() === "synthetic contact"),
  )

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"
  if (no_synthetic && evidence_traceable && !invented_person_ids) {
    certification = after_verified > 0 ? "PASS" : "PASS_PARTIAL"
  }

  const remaining_blockers: string[] = []
  if (after_verified === 0) {
    remaining_blockers.push("no_verified_committee_members — titles/evidence insufficient on PS-HE targets")
  }
  if (after_outreach.outreach_ready_companies < PS_HE_TARGETS.length) {
    remaining_blockers.push("company_level_outreach_ready_tier_not_met")
  }
  if (synthetic_risk > 0) {
    remaining_blockers.push("synthetic_committee_member_risk")
  }

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_BUYING_COMMITTEE_INTELLIGENCE_CERT_7_PS_HP_QA_MARKER,
        foundation_qa_marker: GROWTH_PROSPECT_SEARCH_BUYING_COMMITTEE_FOUNDATION_QA_MARKER,
        certification,
        compliance,
        committee_candidates: candidate_discovery,
        foundation_runs,
        verified_members: {
          before: before_verified,
          after: after_verified,
          delta: after_verified - before_verified,
        },
        coverage: after_snapshots.map((s, i) => ({
          company: PS_HE_TARGETS[i]!.company_name,
          coverage_score: s.coverage.coverage_score,
          roles_present: s.coverage.roles_present,
          roles_missing: s.coverage.roles_missing,
          verified_member_count: s.coverage.verified_member_count,
          members: s.members,
        })),
        outreach_ready_companies: {
          before: before_outreach.outreach_ready_companies,
          after: after_outreach.outreach_ready_companies,
        },
        committee_verified_total: {
          before: before_outreach.committee_verified_total,
          after: after_outreach.committee_verified_total,
        },
        per_company: {
          before: before_outreach.per_company,
          after: after_outreach.per_company,
        },
        readiness_impact: {
          committee_score_delta:
            (after_outreach.per_company as Array<{ committee_score: number }>).reduce(
              (s, r) => s + r.committee_score,
              0,
            ) -
            (before_outreach.per_company as Array<{ committee_score: number }>).reduce(
              (s, r) => s + r.committee_score,
              0,
            ),
        },
        remaining_blockers,
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
