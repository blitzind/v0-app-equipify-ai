/** Apollo single-company search diagnostic — tier A–E search only. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { canonicalNormalizedDomain } from "@/lib/growth/canonical-companies/canonical-company-normalize"
import {
  buildApolloMapperRejectionEvidenceFromTierAttempts,
  buildApolloTierAttemptsCompactSummaries,
} from "@/lib/growth/apollo/apollo-search-diagnostic-evidence"
import {
  assertApolloSingleCompanySearchDiagnosticExecuteAllowed,
  buildApolloSingleCompanySearchDiagnosticReadinessPayload,
  redactApolloSingleCompanySearchDiagnosticSecrets,
} from "@/lib/growth/apollo/apollo-single-company-search-diagnostic-gates"
import { runApolloSharedTieredPeopleSearch } from "@/lib/growth/apollo/apollo-shared-tiered-search"
import { emptyApolloPartialIdentityEvidence } from "@/lib/growth/apollo/apollo-partial-identity-evidence"
import { isApolloMockEnabled } from "@/lib/growth/providers/apollo/apollo-config"
import {
  beginApolloRunGuardrails,
  resetApolloRunGuardrails,
} from "@/lib/growth/providers/apollo/apollo-run-guardrails"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeCompanyName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function companyNameMatches(target: string, candidate: string): boolean {
  const targetNorm = normalizeCompanyName(target)
  const candidateNorm = normalizeCompanyName(candidate)
  if (!targetNorm || !candidateNorm) return false
  return candidateNorm.includes(targetNorm) || targetNorm.includes(candidateNorm)
}

export async function resolveApolloSingleCompanySearchDiagnosticTarget(
  admin: SupabaseClient,
  input: { company_candidate_id?: string | null; company_name?: string | null },
): Promise<{
  company_candidate_id: string
  company_name: string
  domain: string
  city: string | null
  state: string | null
  canonical_company_id: string | null
} | null> {
  const company_candidate_id = asString(input.company_candidate_id)
  const company_name = asString(input.company_name)

  if (company_candidate_id) {
    const { data } = await admin
      .schema("growth")
      .from("discovery_candidates")
      .select("company_id, company_name, domain, website, city, state, canonical_company_id")
      .eq("company_id", company_candidate_id)
      .maybeSingle()

    if (!data) return null
    const row = data as Record<string, unknown>
    const domain = canonicalNormalizedDomain(asString(row.domain), asString(row.website))
    if (!domain) return null
    return {
      company_candidate_id,
      company_name: asString(row.company_name) || company_name,
      domain,
      city: asString(row.city) || null,
      state: asString(row.state) || null,
      canonical_company_id: asString(row.canonical_company_id) || null,
    }
  }

  if (!company_name) return null

  const { data: rows } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .select("company_id, company_name, domain, website, city, state, canonical_company_id")
    .not("canonical_company_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(500)

  const match = (rows ?? []).find((raw) => {
    const row = raw as Record<string, unknown>
    return companyNameMatches(company_name, asString(row.company_name))
  })

  if (!match) return null
  const row = match as Record<string, unknown>
  const domain = canonicalNormalizedDomain(asString(row.domain), asString(row.website))
  if (!domain) return null

  return {
    company_candidate_id: asString(row.company_id),
    company_name: asString(row.company_name) || company_name,
    domain,
    city: asString(row.city) || null,
    state: asString(row.state) || null,
    canonical_company_id: asString(row.canonical_company_id) || null,
  }
}

export async function executeApolloSingleCompanySearchDiagnostic(
  admin: SupabaseClient,
  input: {
    company_candidate_id?: string | null
    company_name?: string | null
    env?: NodeJS.ProcessEnv
  },
) {
  const env = input.env ?? process.env
  const gates = assertApolloSingleCompanySearchDiagnosticExecuteAllowed(env)
  if (!gates.ok) {
    return redactApolloSingleCompanySearchDiagnosticSecrets({
      ok: false,
      error: "gates_failed",
      message: gates.error,
      blockers: gates.blockers,
      company: null,
      tier_attempts: [],
      tier_attempts_compact: [],
      mapper_rejection_evidence: null,
      partial_identity_evidence: emptyApolloPartialIdentityEvidence(),
      search_strategy: null,
      safety: {
        enrollment: false,
        outreach: false,
        enrichment: false,
        promotion: false,
      },
    })
  }

  const company = await resolveApolloSingleCompanySearchDiagnosticTarget(admin, input)
  if (!company) {
    return redactApolloSingleCompanySearchDiagnosticSecrets({
      ok: false,
      error: "company_not_found",
      message: "Could not resolve company_candidate_id or company_name to a discovery candidate with domain.",
      blockers: ["company_not_found"],
      company: null,
      tier_attempts: [],
      tier_attempts_compact: [],
      mapper_rejection_evidence: null,
      partial_identity_evidence: emptyApolloPartialIdentityEvidence(),
      search_strategy: null,
      safety: {
        enrollment: false,
        outreach: false,
        enrichment: false,
        promotion: false,
      },
    })
  }

  const mock = isApolloMockEnabled(env)
  beginApolloRunGuardrails()
  let searchOutcome: Awaited<ReturnType<typeof runApolloSharedTieredPeopleSearch>> | null = null
  try {
    searchOutcome = await runApolloSharedTieredPeopleSearch(
      {
        company_name: company.company_name,
        domain: company.domain,
        website_url: `https://www.${company.domain}`,
        city: company.city ?? undefined,
        state: company.state ?? undefined,
        limit: 25,
      },
      { mock },
    )
  } finally {
    resetApolloRunGuardrails()
  }

  const tier_attempts = searchOutcome.search_strategy.tier_attempts
  const tier_attempts_compact = buildApolloTierAttemptsCompactSummaries(tier_attempts)
  const mapper_rejection_evidence = buildApolloMapperRejectionEvidenceFromTierAttempts(tier_attempts)

  return redactApolloSingleCompanySearchDiagnosticSecrets({
    ok: true,
    error: null,
    message: null,
    blockers: [],
    company: {
      company_candidate_id: company.company_candidate_id,
      company_name: company.company_name,
      domain: company.domain,
      city: company.city,
      state: company.state,
      canonical_company_id: company.canonical_company_id,
    },
    tier_attempts,
    tier_attempts_compact,
    mapper_rejection_evidence,
    partial_identity_evidence: {
      ...emptyApolloPartialIdentityEvidence(),
      mapped_partial_identity_contacts:
        searchOutcome.search_strategy.mapped_partial_identity_contacts ?? 0,
      partial_identity_candidates_staged:
        searchOutcome.search_strategy.mapped_partial_identity_contacts ?? 0,
    },
    search_strategy: searchOutcome.search_strategy,
    search_summary: {
      raw_contacts_returned: searchOutcome.search_strategy.raw_contacts_returned,
      mapped_contacts: searchOutcome.search_strategy.mapped_contacts,
      chosen_tier: searchOutcome.search_strategy.chosen_tier,
      chosen_tier_name: searchOutcome.search_strategy.chosen_tier_name,
      stop_reason: searchOutcome.search_strategy.stop_reason,
      rejection_reasons: searchOutcome.search_strategy.rejection_reasons,
    },
    safety: {
      enrollment: false,
      outreach: false,
      enrichment: false,
      promotion: false,
    },
  })
}

export async function buildApolloSingleCompanySearchDiagnosticReadiness(
  admin: SupabaseClient,
  input?: { env?: NodeJS.ProcessEnv },
) {
  const env = input?.env ?? process.env
  assertApolloSingleCompanySearchDiagnosticExecuteAllowed(env)
  return buildApolloSingleCompanySearchDiagnosticReadinessPayload({ env })
}
