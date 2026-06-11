/** Apollo single-company enrichment diagnostic — bulk_match on mapped contacts only. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { enrichApolloCandidatesNeedingEmail } from "@/lib/growth/apollo/apollo-candidate-email-enrichment"
import {
  buildApolloCompanyEnrichmentEvidence,
  type ApolloCompanyEnrichmentEvidence,
} from "@/lib/growth/apollo/apollo-mapped-contact-enrichment-evidence"
import {
  assertApolloSingleCompanyEnrichmentDiagnosticExecuteAllowed,
  buildApolloSingleCompanyEnrichmentDiagnosticReadinessPayload,
  redactApolloSingleCompanyEnrichmentDiagnosticSecrets,
} from "@/lib/growth/apollo/apollo-single-company-enrichment-diagnostic-gates"
import { resolveApolloSingleCompanySearchDiagnosticTarget } from "@/lib/growth/apollo/apollo-single-company-search-diagnostic"
import { runApolloLivePilotContactDiscovery } from "@/lib/growth/apollo/apollo-live-pilot-contact-discovery"
import type { GrowthContactCandidate } from "@/lib/growth/contact-discovery/contact-discovery-types"
import {
  beginApolloRunGuardrails,
  getApolloRunGuardrailSnapshot,
  resetApolloRunGuardrails,
} from "@/lib/growth/providers/apollo/apollo-run-guardrails"

async function loadApolloCandidates(
  admin: SupabaseClient,
  company_candidate_id: string,
): Promise<GrowthContactCandidate[]> {
  const { data } = await admin
    .schema("growth")
    .from("contact_candidates")
    .select(
      "id, email, phone, linkedin_url, first_name, last_name, job_title, metadata, provider_type, full_name, company_candidate_id",
    )
    .eq("company_candidate_id", company_candidate_id)
    .eq("provider_type", "future_apollo")
    .limit(200)

  return (data ?? []) as GrowthContactCandidate[]
}

export async function executeApolloSingleCompanyEnrichmentDiagnostic(
  admin: SupabaseClient,
  input: {
    company_candidate_id?: string | null
    company_name?: string | null
    rerun_search?: boolean
    env?: NodeJS.ProcessEnv
  },
) {
  const env = input.env ?? process.env
  const gates = assertApolloSingleCompanyEnrichmentDiagnosticExecuteAllowed(env)
  if (!gates.ok) {
    return redactApolloSingleCompanyEnrichmentDiagnosticSecrets({
      ok: false,
      error: "gates_failed",
      message: gates.error,
      blockers: gates.blockers,
      company: null,
      enrichment_evidence: buildApolloCompanyEnrichmentEvidence({ candidates: [], env }),
      safety: {
        enrollment: false,
        outreach: false,
        promotion: false,
        search_rerun: false,
      },
    })
  }

  const company = await resolveApolloSingleCompanySearchDiagnosticTarget(admin, input)
  if (!company) {
    return redactApolloSingleCompanyEnrichmentDiagnosticSecrets({
      ok: false,
      error: "company_not_found",
      message: "Could not resolve company to a discovery candidate with domain.",
      blockers: ["company_not_found"],
      company: null,
      enrichment_evidence: buildApolloCompanyEnrichmentEvidence({ candidates: [], env }),
      safety: {
        enrollment: false,
        outreach: false,
        promotion: false,
        search_rerun: false,
      },
    })
  }

  beginApolloRunGuardrails()
  let search_rerun = false
  try {
    if (input.rerun_search) {
      search_rerun = true
      await runApolloLivePilotContactDiscovery(
        admin,
        {
          company_candidate_id: company.company_candidate_id,
          company_name: company.company_name,
          domain: company.domain,
          website_url: `https://www.${company.domain}`,
          city: company.city,
          state: company.state,
        },
        { fresh_apollo_search: true },
      )
    }

    let candidates = await loadApolloCandidates(admin, company.company_candidate_id)
    const pre_enrichment = buildApolloCompanyEnrichmentEvidence({
      candidates,
      env,
      enrichment_attempted: false,
    })

    let enrichment_attempted = false
    let enrichment_result: Awaited<ReturnType<typeof enrichApolloCandidatesNeedingEmail>> | null = null

    if (pre_enrichment.mapped_contacts_requiring_enrichment > 0) {
      enrichment_attempted = true
      enrichment_result = await enrichApolloCandidatesNeedingEmail(admin, {
        company_candidate_id: company.company_candidate_id,
        domain: company.domain,
        max_people: 25,
        env,
      })
      if (enrichment_result.skipped_reason) enrichment_attempted = false
      candidates = await loadApolloCandidates(admin, company.company_candidate_id)
    }

    const guardrails = getApolloRunGuardrailSnapshot()
    const enrichment_evidence: ApolloCompanyEnrichmentEvidence = buildApolloCompanyEnrichmentEvidence({
      candidates,
      env,
      enrichment_attempted,
      enrichment_result,
      guardrails,
    })

    return redactApolloSingleCompanyEnrichmentDiagnosticSecrets({
      ok: true,
      error: null,
      message: null,
      blockers: enrichment_evidence.enrichment_blockers,
      company: {
        company_candidate_id: company.company_candidate_id,
        company_name: company.company_name,
        domain: company.domain,
        city: company.city,
        state: company.state,
        canonical_company_id: company.canonical_company_id,
      },
      pre_enrichment_summary: {
        mapped_contacts_count: pre_enrichment.mapped_contacts_count,
        mapped_contacts_requiring_enrichment: pre_enrichment.mapped_contacts_requiring_enrichment,
        enrichment_blockers: pre_enrichment.enrichment_blockers,
      },
      enrichment_evidence,
      safety: {
        enrollment: false,
        outreach: false,
        promotion: false,
        search_rerun,
      },
    })
  } finally {
    resetApolloRunGuardrails()
  }
}

export async function buildApolloSingleCompanyEnrichmentDiagnosticReadiness(
  admin: SupabaseClient,
  input?: { env?: NodeJS.ProcessEnv },
) {
  const env = input?.env ?? process.env
  assertApolloSingleCompanyEnrichmentDiagnosticExecuteAllowed(env)
  return buildApolloSingleCompanyEnrichmentDiagnosticReadinessPayload({ env })
}
