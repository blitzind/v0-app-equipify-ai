/** Apollo enrichment recovery — re-run bulk_match + promotion for failed yield companies. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildApollo25CompanyPilotEligibilityDiagnostic } from "@/lib/growth/apollo/apollo-25-company-pilot-eligibility-diagnostic"
import {
  buildApollo25CompanyPilotSelectionInputs,
  type Apollo25CompanyPilotSelectionInput,
} from "@/lib/growth/apollo/apollo-25-company-pilot-route"
import { APOLLO_25_COMPANY_PILOT_TARGET_COUNT } from "@/lib/growth/apollo/apollo-25-company-pilot-types"
import { runApolloPrimaryContactAcquisition } from "@/lib/growth/apollo/apollo-primary-contact-acquisition"
import type { ApolloPrimaryContactAcquisitionCompanyEvidence } from "@/lib/growth/apollo/apollo-primary-contact-acquisition-evidence"
import { resolveApolloEnrollmentQualificationThreshold } from "@/lib/growth/apollo/apollo-enrollment-qualification-engine"

import {
  APOLLO_ENRICHMENT_RECOVERY_QA_MARKER,
  pct,
  resolveApolloEnrichmentRecoveryStrategy,
  selectApolloEnrichmentRecoveryTargets,
  type ApolloEnrichmentRecoveryStrategy,
} from "@/lib/growth/apollo/apollo-enrichment-recovery-types"

export {
  APOLLO_ENRICHMENT_RECOVERY_QA_MARKER,
  resolveApolloEnrichmentRecoveryStrategy,
  selectApolloEnrichmentRecoveryTargets,
  type ApolloEnrichmentRecoveryStrategy,
} from "@/lib/growth/apollo/apollo-enrichment-recovery-types"

export type ApolloEnrichmentRecoveryCompanyResult = {
  company_candidate_id: string
  company_name: string
  strategy: ApolloEnrichmentRecoveryStrategy
  verified_email_contacts_before: number
  verified_email_contacts_after: number
  enrichment_attempted: boolean
  enrichment_candidates_updated: number
  promoted_contacts: number
  sequence_ready_contacts: number
  apollo_search_attempted: boolean
  ok: boolean
  blockers: string[]
}

export type ApolloEnrichmentRecoveryMetrics = {
  verified_email_companies: number
  qualified_companies: number
  greenfield_available: number
  companies_discovered: number
}

export type ApolloEnrichmentRecoveryReport = {
  qa_marker: typeof APOLLO_ENRICHMENT_RECOVERY_QA_MARKER
  computed_at: string
  before: ApolloEnrichmentRecoveryMetrics
  after: ApolloEnrichmentRecoveryMetrics
  companies_targeted: number
  companies_processed: number
  companies_recovered: number
  contacts_enriched: number
  emails_recovered: number
  companies_promoted_to_verified: number
  company_results: ApolloEnrichmentRecoveryCompanyResult[]
  remaining_failure_counts: Record<string, number>
  yield_before_pct: number
  yield_after_pct: number
  net_improvement_pct: number
  no_outreach_side_effects: true
}

export async function measureApolloEnrichmentRecoveryMetrics(
  admin: SupabaseClient,
): Promise<ApolloEnrichmentRecoveryMetrics> {
  const production_threshold = resolveApolloEnrollmentQualificationThreshold()
  const selection_inputs = await buildApollo25CompanyPilotSelectionInputs(admin)
  const diagnostic = buildApollo25CompanyPilotEligibilityDiagnostic(selection_inputs, {
    production_threshold,
    pilot_selection_mode: "greenfield",
    target_count: APOLLO_25_COMPANY_PILOT_TARGET_COUNT,
  })

  return {
    companies_discovered: diagnostic.funnel_counts.total_apollo_discovered_companies,
    verified_email_companies: diagnostic.funnel_counts.companies_with_verified_email,
    qualified_companies: diagnostic.funnel_counts.companies_with_qualification_score_gte_threshold,
    greenfield_available: diagnostic.funnel_counts.companies_eligible_greenfield,
  }
}

function companyResultFromEvidence(input: {
  company: Apollo25CompanyPilotSelectionInput
  strategy: ApolloEnrichmentRecoveryStrategy
  verified_before: number
  verified_after: number
  evidence: ApolloPrimaryContactAcquisitionCompanyEvidence | null
  error: string | null
}): ApolloEnrichmentRecoveryCompanyResult {
  const companyEvidence = input.evidence
  const promotedDelta = Math.max(0, input.verified_after - input.verified_before)

  return {
    company_candidate_id: input.company.company_candidate_id,
    company_name: input.company.company_name,
    strategy: input.strategy,
    verified_email_contacts_before: input.verified_before,
    verified_email_contacts_after: input.verified_after,
    enrichment_attempted: companyEvidence?.enrichment_attempted ?? false,
    enrichment_candidates_updated: companyEvidence?.enrichment_candidates_updated ?? 0,
    promoted_contacts: companyEvidence?.promoted_contacts ?? 0,
    sequence_ready_contacts: companyEvidence?.sequence_ready_contacts ?? 0,
    apollo_search_attempted: companyEvidence?.apollo_search_attempted ?? false,
    ok: promotedDelta > 0 || (companyEvidence?.enrichment_candidates_updated ?? 0) > 0,
    blockers: [
      ...(input.error ? [input.error] : []),
      ...(companyEvidence?.blockers ?? []),
    ],
  }
}

async function loadVerifiedEmailCountForCompany(
  admin: SupabaseClient,
  company_candidate_id: string,
): Promise<number> {
  const inputs = await buildApollo25CompanyPilotSelectionInputs(admin, {
    company_ids: [company_candidate_id],
  })
  return inputs[0]?.snapshot_summary.verified_email_contacts ?? 0
}

export async function runApolloEnrichmentRecovery(
  admin: SupabaseClient,
  input?: {
    company_candidate_ids?: string[]
    contact_limit?: number
    created_by?: string | null
    env?: NodeJS.ProcessEnv
    dry_run?: boolean
    limit?: number
    offset?: number
    stop_after_recovered_companies?: number | null
    skip_funnel_metrics?: boolean
  },
): Promise<ApolloEnrichmentRecoveryReport> {
  const env = input?.env ?? process.env
  const skip_funnel_metrics = input?.skip_funnel_metrics === true
  const before = skip_funnel_metrics
    ? {
        companies_discovered: 0,
        verified_email_companies: 0,
        qualified_companies: 0,
        greenfield_available: 0,
      }
    : await measureApolloEnrichmentRecoveryMetrics(admin)
  const selection_inputs = await buildApollo25CompanyPilotSelectionInputs(admin)
  let targets =
    input?.company_candidate_ids?.length
      ? selection_inputs.filter((row) =>
          input.company_candidate_ids!.includes(row.company_candidate_id),
        )
      : selectApolloEnrichmentRecoveryTargets(selection_inputs)

  if (input?.offset != null && input.offset > 0) {
    targets = targets.slice(Math.floor(input.offset))
  }
  if (input?.limit != null && input.limit > 0) {
    targets = targets.slice(0, Math.floor(input.limit))
  }

  const company_results: ApolloEnrichmentRecoveryCompanyResult[] = []
  let companies_processed = 0
  let companies_recovered_so_far = 0
  const stopAfter =
    input?.stop_after_recovered_companies != null && input.stop_after_recovered_companies > 0
      ? Math.floor(input.stop_after_recovered_companies)
      : null

  if (!input?.dry_run) {
    for (const company of targets) {
      if (stopAfter != null && companies_recovered_so_far >= stopAfter) break

      const strategy = resolveApolloEnrichmentRecoveryStrategy(company)
      const verified_before = company.snapshot_summary.verified_email_contacts

      try {
        const evidence = await runApolloPrimaryContactAcquisition(admin, {
          company_candidate_ids: [company.company_candidate_id],
          contact_limit: input?.contact_limit,
          created_by: input?.created_by ?? null,
          env,
          skip_apollo_search_if_existing_contactable: strategy === "enrichment_only",
        })

        const companyEvidence = evidence.companies[0] ?? null
        const verified_after = await loadVerifiedEmailCountForCompany(
          admin,
          company.company_candidate_id,
        )

        company_results.push(
          companyResultFromEvidence({
            company,
            strategy,
            verified_before,
            verified_after,
            evidence: companyEvidence,
            error: null,
          }),
        )
        companies_processed += 1
        if (verified_after > verified_before) {
          companies_recovered_so_far += 1
        }
      } catch (error) {
        company_results.push(
          companyResultFromEvidence({
            company,
            strategy,
            verified_before,
            verified_after: verified_before,
            evidence: null,
            error: error instanceof Error ? error.message : String(error),
          }),
        )
        companies_processed += 1
      }
    }
  }

  const after = input?.dry_run || skip_funnel_metrics
    ? before
    : await measureApolloEnrichmentRecoveryMetrics(admin)

  const production_threshold = resolveApolloEnrollmentQualificationThreshold()
  const postDiagnostic = skip_funnel_metrics
    ? { skipped_reason_counts: {} as Record<string, number> }
    : buildApollo25CompanyPilotEligibilityDiagnostic(
        await buildApollo25CompanyPilotSelectionInputs(admin),
        {
          production_threshold,
          pilot_selection_mode: "greenfield",
          target_count: APOLLO_25_COMPANY_PILOT_TARGET_COUNT,
        },
      )

  const companies_recovered = company_results.filter(
    (row) => row.verified_email_contacts_after > row.verified_email_contacts_before,
  ).length
  const contacts_enriched = company_results.reduce(
    (sum, row) => sum + row.enrichment_candidates_updated,
    0,
  )
  const emails_recovered = company_results.reduce(
    (sum, row) =>
      sum + Math.max(0, row.verified_email_contacts_after - row.verified_email_contacts_before),
    0,
  )

  return {
    qa_marker: APOLLO_ENRICHMENT_RECOVERY_QA_MARKER,
    computed_at: new Date().toISOString(),
    before: {
      verified_email_companies: before.verified_email_companies,
      qualified_companies: before.qualified_companies,
      greenfield_available: before.greenfield_available,
      companies_discovered: before.companies_discovered,
    },
    after: {
      verified_email_companies: after.verified_email_companies,
      qualified_companies: after.qualified_companies,
      greenfield_available: after.greenfield_available,
      companies_discovered: after.companies_discovered,
    },
    companies_targeted: targets.length,
    companies_processed: input?.dry_run ? 0 : companies_processed,
    companies_recovered,
    contacts_enriched,
    emails_recovered,
    companies_promoted_to_verified: companies_recovered,
    company_results,
    remaining_failure_counts: postDiagnostic.skipped_reason_counts,
    yield_before_pct: pct(before.verified_email_companies, before.companies_discovered),
    yield_after_pct: pct(after.verified_email_companies, after.companies_discovered),
    net_improvement_pct:
      pct(after.verified_email_companies, after.companies_discovered) -
      pct(before.verified_email_companies, before.companies_discovered),
    no_outreach_side_effects: true,
  }
}
