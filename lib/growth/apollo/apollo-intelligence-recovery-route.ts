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
import {
  buildApolloIntelligenceRecoveryChunkMeta,
  resolveApolloIntelligenceRecoveryChunkLimit,
} from "@/lib/growth/apollo/apollo-intelligence-recovery-chunking"
import { buildApolloIntelligenceRecoveryFunnelFromSelectionInputs } from "@/lib/growth/apollo/apollo-intelligence-recovery-funnel"
import {
  APOLLO_INTELLIGENCE_RECOVERY_EXECUTE_CONFIRM,
  assertApolloIntelligenceRecoveryEnvAllowed,
} from "@/lib/growth/apollo/apollo-intelligence-recovery-gates"
import {
  buildApolloIntelligenceRecoveryCompanyEvidence,
  aggregateApolloIntelligenceRecoveryWriteEvidence,
  evaluateApolloIntelligenceRecoveryNoOp,
} from "@/lib/growth/apollo/apollo-intelligence-recovery-evidence"
import type { ApolloIntelligenceRecoveryIntelligenceOutcome } from "@/lib/growth/apollo/apollo-intelligence-recovery-types"
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

type ApolloIntelligenceRecoverySelectionInputs = Awaited<
  ReturnType<typeof buildApollo25CompanyPilotSelectionInputs>
>

async function buildEnrichedSelectionInputs(
  admin: SupabaseClient,
  baseInputs: ApolloIntelligenceRecoverySelectionInputs,
): Promise<ApolloIntelligenceRecoverySelectionInputs> {
  const enriched: ApolloIntelligenceRecoverySelectionInputs = []

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
    offset?: number
    limit?: number
  },
): Promise<ApolloIntelligenceRecoveryReport> {
  const production_threshold = resolveApolloEnrollmentQualificationThreshold()
  const schema = await probeProspectSearchEngineIntelligenceSchema(admin).catch(() => null)

  const offset = Math.max(0, input.offset ?? 0)
  const baseInputs = await buildApollo25CompanyPilotSelectionInputs(admin)
  const total_discovered_companies = baseInputs.length
  const chunkLimit = resolveApolloIntelligenceRecoveryChunkLimit(
    input.mode,
    input.limit,
    total_discovered_companies,
  )
  const chunkEnd = Math.min(offset + chunkLimit, total_discovered_companies)
  const processed_count = Math.max(0, chunkEnd - offset)

  const allEnrichedInputs = await buildEnrichedSelectionInputs(admin, baseInputs)
  const before = buildApolloIntelligenceRecoveryFunnelFromSelectionInputs(
    allEnrichedInputs,
    production_threshold,
  )

  const chunkInputs = allEnrichedInputs.slice(offset, chunkEnd)
  const chunk = buildApolloIntelligenceRecoveryChunkMeta({
    offset,
    limit: chunkLimit,
    total_discovered_companies,
    processed_count,
  })

  const writes_performed = input.mode === "recover_missing_intelligence"
  const company_results: ApolloIntelligenceRecoveryReport["company_results"] = []
  const company_evidence: ApolloIntelligenceRecoveryReport["company_evidence"] = []
  const scoreRows: ReturnType<typeof buildApolloIntelligenceRecoveryScoreDecompositionRow>[] = []
  const canonical_audit: ApolloIntelligenceRecoveryReport["canonical_audit"] = []
  const intelligence_audit: ApolloIntelligenceRecoveryReport["intelligence_audit"] = []

  let canonical_resolved_count = 0
  let company_intelligence_count = 0
  let buying_committee_count = 0
  let fit_score_count = 0
  let research_score_count = 0

  for (const baseInput of chunkInputs) {
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

    const canonical_company_id_before = resolution.canonical_company_id
    let canonicalId = canonical_company_id_before
    const recovery_actions: string[] = []
    const errors: string[] = []

    const canonical_resolution_attempted = writes_performed
    const canonical_resolution_result: "resolved" | "unresolved" | "not_attempted" =
      !canonical_resolution_attempted
        ? "not_attempted"
        : canonicalId
          ? "resolved"
          : "unresolved"
    const canonical_resolution_blocker =
      canonicalId ? null : resolution.resolution_blockers[0] ?? resolution.evidence.blocker_reason

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

    let company_intelligence_attempted = false
    let company_intelligence_outcome: ApolloIntelligenceRecoveryIntelligenceOutcome = "skipped"
    let company_intelligence_error: string | null = null

    let buying_committee_attempted = false
    let buying_committee_outcome: ApolloIntelligenceRecoveryIntelligenceOutcome = "skipped"
    let buying_committee_error: string | null = null

    const hadVerifiedCompanyIntelligence =
      engine.company_intelligence?.has_verified_intelligence === true
    const hadBuyingCommitteeMembers = (engine.buying_committee?.member_count ?? 0) > 0

    if (
      writes_performed &&
      input.mode === "recover_missing_intelligence" &&
      canonicalId &&
      !hadVerifiedCompanyIntelligence
    ) {
      company_intelligence_attempted = true
      recovery_actions.push("run_company_intelligence")
      try {
        const runResult = await runCompanyIntelligenceForCanonicalCompany(admin, {
          company_id: canonicalId,
          created_by: input.created_by,
          promote: true,
        })
        engine = await loadProspectSearchEngineIntelligence(admin, {
          source_type: "external_discovered",
          id: baseInput.company_candidate_id,
          growth_lead_id: baseInput.growth_lead_id ?? null,
          canonical_company_id: canonicalId,
        })
        const verifiedAfter = engine.company_intelligence?.has_verified_intelligence === true
        if (verifiedAfter && !hadVerifiedCompanyIntelligence) {
          company_intelligence_outcome = "created"
        } else if (verifiedAfter) {
          company_intelligence_outcome = "reused"
        } else if (runResult.promoted_count > 0) {
          company_intelligence_outcome = "created"
        } else {
          company_intelligence_outcome = "failed"
          company_intelligence_error = "company_intelligence_run_completed_without_verified_promotion"
          errors.push(company_intelligence_error)
        }
      } catch (e) {
        company_intelligence_outcome = "failed"
        company_intelligence_error = e instanceof Error ? e.message : "company_intelligence_failed"
        errors.push(company_intelligence_error)
      }
    } else if (hadVerifiedCompanyIntelligence) {
      company_intelligence_outcome = "reused"
    }

    if (
      writes_performed &&
      input.mode === "recover_missing_intelligence" &&
      canonicalId &&
      (engine.buying_committee?.member_count ?? 0) === 0
    ) {
      buying_committee_attempted = true
      recovery_actions.push("run_buying_committee_intelligence")
      try {
        const runResult = await runBuyingCommitteeIntelligenceForCanonicalCompany(admin, {
          company_id: canonicalId,
          created_by: input.created_by,
          promote: true,
        })
        engine = await loadProspectSearchEngineIntelligence(admin, {
          source_type: "external_discovered",
          id: baseInput.company_candidate_id,
          growth_lead_id: baseInput.growth_lead_id ?? null,
          canonical_company_id: canonicalId,
        })
        const membersAfter = engine.buying_committee?.member_count ?? 0
        if (membersAfter > 0 && !hadBuyingCommitteeMembers) {
          buying_committee_outcome = "created"
        } else if (membersAfter > 0) {
          buying_committee_outcome = "reused"
        } else if (runResult.promoted_count > 0 || runResult.member_count > 0) {
          buying_committee_outcome = "created"
        } else {
          buying_committee_outcome = "failed"
          buying_committee_error = "buying_committee_run_completed_without_members"
          errors.push(buying_committee_error)
        }
      } catch (e) {
        buying_committee_outcome = "failed"
        buying_committee_error = e instanceof Error ? e.message : "buying_committee_intelligence_failed"
        errors.push(buying_committee_error)
      }
    } else if (hadBuyingCommitteeMembers) {
      buying_committee_outcome = "reused"
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

    company_evidence.push(
      buildApolloIntelligenceRecoveryCompanyEvidence({
        company_candidate_id: baseInput.company_candidate_id,
        company_name: baseInput.company_name,
        canonical_company_id_before,
        canonical_company_id_after: canonicalId,
        canonical_resolution_attempted,
        canonical_resolution_result,
        canonical_resolution_blocker,
        company_intelligence_before: baseInput.company_intelligence_present ?? false,
        company_intelligence_after: afterContext.company_intelligence_present,
        company_intelligence_attempted,
        company_intelligence_outcome,
        company_intelligence_error,
        buying_committee_before: baseInput.buying_committee_present ?? false,
        buying_committee_after: afterContext.buying_committee_present,
        buying_committee_attempted,
        buying_committee_outcome,
        buying_committee_error,
        fit_score_before: baseInput.fit_score ?? null,
        fit_score_after: afterContext.fit_score,
        research_score_before: baseInput.research_score ?? null,
        research_score_after: afterContext.research_score,
        qualification_score_before: beforeRow.current_score,
        qualification_score_after: afterRow.current_score,
        remaining_blockers: afterRow.blockers,
        production_threshold,
      }),
    )
  }

  const afterInputs = [...allEnrichedInputs]
  for (const baseInput of chunkInputs) {
    const resolution = await resolveApolloEnrichmentCanonicalCompanyId(admin, {
      company_candidate_id: baseInput.company_candidate_id,
    })
    const idx = afterInputs.findIndex(
      (row) => row.company_candidate_id === baseInput.company_candidate_id,
    )
    if (idx < 0) continue
    afterInputs[idx] = await enrichApollo25CompanyPilotSelectionInputWithIntelligence(
      admin,
      afterInputs[idx],
      resolution.canonical_company_id,
    )
  }
  const after = buildApolloIntelligenceRecoveryFunnelFromSelectionInputs(
    afterInputs,
    production_threshold,
  )

  const decomposition_summary = summarizeApolloIntelligenceRecoveryScoreDecomposition(scoreRows)
  const write_evidence = aggregateApolloIntelligenceRecoveryWriteEvidence(company_evidence)
  const noOpEvaluation = evaluateApolloIntelligenceRecoveryNoOp({
    mode: input.mode,
    writes_performed,
    write_evidence,
    processed_count,
  })

  return {
    qa_marker: APOLLO_INTELLIGENCE_RECOVERY_QA_MARKER,
    mode: input.mode,
    computed_at: new Date().toISOString(),
    chunk,
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
    company_evidence,
    write_evidence,
    recovery_ok: noOpEvaluation.recovery_ok,
    severity: noOpEvaluation.severity,
    no_op_root_cause: noOpEvaluation.no_op_root_cause,
    top_no_op_reasons: noOpEvaluation.top_no_op_reasons,
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
