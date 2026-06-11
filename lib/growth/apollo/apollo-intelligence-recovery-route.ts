/** Apollo intelligence recovery — server-only route handlers. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveApolloEnrichmentCanonicalCompanyId } from "@/lib/growth/apollo/apollo-enrichment-cert-canonical-company-resolution"
import {
  buildApollo25CompanyPilotSelectionInputs,
  loadApolloDiscoveredCompanyIds,
} from "@/lib/growth/apollo/apollo-25-company-pilot-route"
import { resolveApolloEnrollmentQualificationThreshold } from "@/lib/growth/apollo/apollo-enrollment-qualification-engine"
import {
  buildApolloIntelligenceRecoveryCanonicalAuditRow,
  buildApolloIntelligenceRecoveryIntelligenceAuditRow,
} from "@/lib/growth/apollo/apollo-intelligence-recovery-audit"
import {
  enrichApollo25CompanyPilotSelectionInputWithIntelligence,
  loadLatestProspectResearchRunIdForCompanyCandidate,
} from "@/lib/growth/apollo/apollo-intelligence-recovery-enrichment"
import { buildApolloIntelligenceRecoveryFunnelFromSelectionInputs } from "@/lib/growth/apollo/apollo-intelligence-recovery-funnel"
import {
  APOLLO_INTELLIGENCE_RECOVERY_EXECUTE_CONFIRM,
  assertApolloIntelligenceRecoveryEnvAllowed,
} from "@/lib/growth/apollo/apollo-intelligence-recovery-gates"
import {
  buildApolloIntelligenceRecoveryQualificationContext,
  buildApolloIntelligenceRecoveryRootCauseSummary,
  buildApolloIntelligenceRecoveryScoreDecompositionRow,
  summarizeApolloIntelligenceRecoveryScoreDecomposition,
} from "@/lib/growth/apollo/apollo-intelligence-recovery-qualification"
import {
  APOLLO_INTELLIGENCE_RECOVERY_QA_MARKER,
  type ApolloIntelligenceRecoveryMode,
  type ApolloIntelligenceRecoveryReadiness,
  type ApolloIntelligenceRecoveryReport,
} from "@/lib/growth/apollo/apollo-intelligence-recovery-types"
import { loadProspectSearchEngineIntelligence } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-loader"
import { probeProspectSearchEngineIntelligenceSchema } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-schema-health"
import { runBuyingCommitteeIntelligenceForCanonicalCompany } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-orchestrator"
import { runCompanyIntelligenceForCanonicalCompany } from "@/lib/growth/company-intelligence/company-intelligence-orchestrator"
import { loadApolloPrimaryContactOperatorReviewSnapshot } from "@/lib/growth/apollo/apollo-primary-contact-operator-review"

export { loadApolloDiscoveredCompanyIds } from "@/lib/growth/apollo/apollo-25-company-pilot-route"

async function buildEnrichedSelectionInputs(admin: SupabaseClient): Promise<
  Awaited<ReturnType<typeof buildApollo25CompanyPilotSelectionInputs>>
> {
  const baseInputs = await buildApollo25CompanyPilotSelectionInputs(admin)
  const enriched: typeof baseInputs = []

  for (const input of baseInputs) {
    const resolution = await resolveApolloEnrichmentCanonicalCompanyId(admin, {
      company_candidate_id: input.company_candidate_id,
    })
    enriched.push(
      await enrichApollo25CompanyPilotSelectionInputWithIntelligence(
        admin,
        input,
        resolution.canonical_company_id,
      ),
    )
  }

  return enriched
}

export async function loadApolloIntelligenceRecoveryReadiness(
  admin: SupabaseClient,
): Promise<ApolloIntelligenceRecoveryReadiness> {
  const envGate = assertApolloIntelligenceRecoveryEnvAllowed()
  const schema = await probeProspectSearchEngineIntelligenceSchema(admin).catch(() => ({
    ready: false,
    verified: false,
    uncertain: true,
    missing_objects: ["schema_probe_failed"],
    warning_message: "Intelligence schema probe failed.",
    env_hint: null,
  }))

  const companyIds = await loadApolloDiscoveredCompanyIds(admin)
  const blockers = [...envGate.blockers]
  if (!schema.ready) {
    blockers.push("prospect_search_engine_intelligence_schema_not_ready")
  }

  return {
    qa_marker: APOLLO_INTELLIGENCE_RECOVERY_QA_MARKER,
    ready: blockers.length === 0,
    blockers,
    intelligence_schema_ready: schema.ready,
    production_qualification_threshold: resolveApolloEnrollmentQualificationThreshold(),
    apollo_discovered_company_count: companyIds.length,
    confirm_token: APOLLO_INTELLIGENCE_RECOVERY_EXECUTE_CONFIRM,
  }
}

export async function executeApolloIntelligenceRecovery(
  admin: SupabaseClient,
  input: {
    mode: ApolloIntelligenceRecoveryMode
    created_by?: string | null
  },
): Promise<ApolloIntelligenceRecoveryReport> {
  const production_threshold = resolveApolloEnrollmentQualificationThreshold()
  const schema = await probeProspectSearchEngineIntelligenceSchema(admin).catch(() => null)

  const beforeInputs = await buildEnrichedSelectionInputs(admin)
  const before = buildApolloIntelligenceRecoveryFunnelFromSelectionInputs(
    beforeInputs,
    production_threshold,
  )

  const writes_performed = input.mode === "recover_missing_intelligence"
  const company_results: ApolloIntelligenceRecoveryReport["company_results"] = []
  const scoreRows: ReturnType<typeof buildApolloIntelligenceRecoveryScoreDecompositionRow>[] = []
  const canonical_audit: ApolloIntelligenceRecoveryReport["canonical_audit"] = []
  const intelligence_audit: ApolloIntelligenceRecoveryReport["intelligence_audit"] = []

  let canonical_resolved_count = 0
  let company_intelligence_count = 0
  let buying_committee_count = 0
  let fit_score_count = 0
  let research_score_count = 0

  for (const baseInput of beforeInputs) {
    const snapshot = await loadApolloPrimaryContactOperatorReviewSnapshot(
      admin,
      baseInput.company_candidate_id,
    )
    if (!snapshot) continue

    const beforeRow = buildApolloIntelligenceRecoveryScoreDecompositionRow({
      company_candidate_id: baseInput.company_candidate_id,
      company_name: baseInput.company_name,
      contacts: baseInput.contacts,
      snapshot_summary: baseInput.snapshot_summary,
      qualificationContext: {
        company_intelligence_present: baseInput.company_intelligence_present ?? false,
        buying_committee_present: baseInput.buying_committee_present ?? false,
        buying_committee_coverage: baseInput.buying_committee_coverage ?? null,
        fit_score: baseInput.fit_score ?? null,
        research_score: baseInput.research_score ?? null,
      },
      production_threshold,
    })

    const resolution = await resolveApolloEnrichmentCanonicalCompanyId(admin, {
      company_candidate_id: baseInput.company_candidate_id,
    })

    let canonicalId = resolution.canonical_company_id
    const recovery_actions: string[] = []
    const errors: string[] = []

    canonical_audit.push(
      buildApolloIntelligenceRecoveryCanonicalAuditRow({
        company_candidate_id: baseInput.company_candidate_id,
        company_name: baseInput.company_name,
        canonical_company_id: canonicalId,
        evidence: resolution.evidence,
        resolution_blockers: resolution.resolution_blockers,
      }),
    )

    if (canonicalId) canonical_resolved_count += 1

    const latestResearchRunId = await loadLatestProspectResearchRunIdForCompanyCandidate(
      admin,
      baseInput.company_candidate_id,
    )

    let engine = await loadProspectSearchEngineIntelligence(admin, {
      source_type: "external_discovered",
      id: baseInput.company_candidate_id,
      growth_lead_id: baseInput.growth_lead_id ?? null,
      canonical_company_id: canonicalId,
    })

    if (
      writes_performed &&
      input.mode === "recover_missing_intelligence" &&
      canonicalId &&
      !engine.company_intelligence?.has_verified_intelligence
    ) {
      recovery_actions.push("run_company_intelligence")
      try {
        await runCompanyIntelligenceForCanonicalCompany(admin, {
          company_id: canonicalId,
          created_by: input.created_by,
          promote: true,
        })
      } catch (e) {
        errors.push(e instanceof Error ? e.message : "company_intelligence_failed")
      }
      engine = await loadProspectSearchEngineIntelligence(admin, {
        source_type: "external_discovered",
        id: baseInput.company_candidate_id,
        growth_lead_id: baseInput.growth_lead_id ?? null,
        canonical_company_id: canonicalId,
      })
    }

    if (
      writes_performed &&
      input.mode === "recover_missing_intelligence" &&
      canonicalId &&
      (engine.buying_committee?.member_count ?? 0) === 0
    ) {
      recovery_actions.push("run_buying_committee_intelligence")
      try {
        await runBuyingCommitteeIntelligenceForCanonicalCompany(admin, {
          company_id: canonicalId,
          created_by: input.created_by,
          promote: true,
        })
      } catch (e) {
        errors.push(e instanceof Error ? e.message : "buying_committee_intelligence_failed")
      }
      engine = await loadProspectSearchEngineIntelligence(admin, {
        source_type: "external_discovered",
        id: baseInput.company_candidate_id,
        growth_lead_id: baseInput.growth_lead_id ?? null,
        canonical_company_id: canonicalId,
      })
    }

    const intelligenceRow = buildApolloIntelligenceRecoveryIntelligenceAuditRow({
      company_candidate_id: baseInput.company_candidate_id,
      company_name: baseInput.company_name,
      canonical_company_id: canonicalId,
      engine,
      latest_research_run_id: latestResearchRunId,
      research_cache_stale_or_missing: !latestResearchRunId,
    })
    intelligence_audit.push(intelligenceRow)

    if (intelligenceRow.company_intelligence_verified) company_intelligence_count += 1
    if (intelligenceRow.buying_committee_exists) buying_committee_count += 1
    if (intelligenceRow.fit_score_exists) fit_score_count += 1
    if (intelligenceRow.research_score_exists) research_score_count += 1

    const afterContext = buildApolloIntelligenceRecoveryQualificationContext(engine)
    const afterRow = buildApolloIntelligenceRecoveryScoreDecompositionRow({
      company_candidate_id: baseInput.company_candidate_id,
      company_name: baseInput.company_name,
      contacts: baseInput.contacts,
      snapshot_summary: baseInput.snapshot_summary,
      qualificationContext: afterContext,
      production_threshold,
    })
    scoreRows.push(afterRow)

    const intelligence_added: string[] = []
    if (afterContext.company_intelligence_present && !baseInput.company_intelligence_present) {
      intelligence_added.push("company_intelligence")
    }
    if (afterContext.buying_committee_present && !baseInput.buying_committee_present) {
      intelligence_added.push("buying_committee")
    }
    if (afterContext.fit_score != null && baseInput.fit_score == null) {
      intelligence_added.push("fit_score")
    }
    if (afterContext.research_score != null && baseInput.research_score == null) {
      intelligence_added.push("research_score")
    }

    company_results.push({
      company_candidate_id: baseInput.company_candidate_id,
      company_name: baseInput.company_name,
      before_score: beforeRow.current_score,
      after_score: afterRow.current_score,
      intelligence_added,
      remaining_blockers: afterRow.blockers,
      recovery_actions,
      errors,
    })
  }

  const afterInputs = await buildEnrichedSelectionInputs(admin)
  const after = buildApolloIntelligenceRecoveryFunnelFromSelectionInputs(
    afterInputs,
    production_threshold,
  )

  const decomposition_summary = summarizeApolloIntelligenceRecoveryScoreDecomposition(scoreRows)

  return {
    qa_marker: APOLLO_INTELLIGENCE_RECOVERY_QA_MARKER,
    mode: input.mode,
    computed_at: new Date().toISOString(),
    writes_performed,
    before,
    after,
    after_recovery_counts: {
      canonical_resolved_count,
      company_intelligence_count,
      buying_committee_count,
      fit_score_count,
      research_score_count,
      score_gte_threshold_count: after.score_gte_threshold_companies,
      projected_greenfield_eligible_count: after.eligible_greenfield_companies,
    },
    score_decomposition: {
      rows: scoreRows,
      summary: decomposition_summary,
    },
    canonical_audit,
    intelligence_audit,
    company_results,
    root_cause_summary: buildApolloIntelligenceRecoveryRootCauseSummary({
      before: {
        score_gte_threshold_companies: before.score_gte_threshold_companies,
        eligible_greenfield_companies: before.eligible_greenfield_companies,
      },
      after: {
        score_gte_threshold_companies: after.score_gte_threshold_companies,
        eligible_greenfield_companies: after.eligible_greenfield_companies,
      },
      decomposition_summary,
      intelligence_schema_ready: schema?.ready ?? false,
    }),
    no_outreach_side_effects: true,
    no_enrollment_candidates_created: true,
  }
}
