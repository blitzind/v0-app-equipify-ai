/** Apollo enrichment recovery production route orchestration — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  runApolloEnrichmentRecovery,
  type ApolloEnrichmentRecoveryCompanyResult,
  type ApolloEnrichmentRecoveryReport,
} from "@/lib/growth/apollo/apollo-enrichment-recovery"
import {
  assertApolloEnrichmentRecoveryExecuteAllowed,
  buildApolloEnrichmentRecoveryReadinessPayload,
  redactApolloEnrichmentRecoverySecrets,
  type ApolloEnrichmentRecoveryExecuteInput,
} from "@/lib/growth/apollo/apollo-enrichment-recovery-route-gates"

export type ApolloEnrichmentRecoveryCompanySummary = {
  company: string
  company_candidate_id: string
  strategy: "enrichment_only" | "full_reacquisition"
  bulk_match_invoked: boolean
  contacts_enriched: number
  emails_recovered: number
  verified_email_ready_before: boolean
  verified_email_ready_after: boolean
  blockers: string[]
}

export type ApolloEnrichmentRecoveryExecuteResult = {
  ok: boolean
  execution_id: string
  dry_run: boolean
  error?: "gates_failed"
  message?: string | null
  blockers?: string[]
  safety: {
    no_sends: true
    no_outbound: true
    no_sequence_execution: true
    no_approval_bypass: true
  }
  recovery_results: {
    companies_targeted: number
    companies_processed: number
    companies_recovered: number
    contacts_enriched: number
    emails_recovered: number
    companies_promoted_to_verified: number
    errors: string[]
    provider_blockers: string[]
  }
  company_summaries: ApolloEnrichmentRecoveryCompanySummary[]
  before_after: {
    verified_email_companies_before: number
    verified_email_companies_after: number
    qualified_companies_before: number
    qualified_companies_after: number
    greenfield_before: number
    greenfield_after: number
    yield_before_pct: number
    yield_after_pct: number
    net_improvement_pct: number
  }
  report: ApolloEnrichmentRecoveryReport | null
}

const PROVIDER_DISABLED_BLOCKERS = new Set([
  "enrichment_provider_disabled",
  "enrichment_gates_blocked",
])

function bulkMatchInvokedFromCompanyResult(row: ApolloEnrichmentRecoveryCompanyResult): boolean {
  if (!row.enrichment_attempted) return false
  if (row.blockers.some((blocker) => PROVIDER_DISABLED_BLOCKERS.has(blocker))) return false
  return true
}

function companySummaryFromResult(
  row: ApolloEnrichmentRecoveryCompanyResult,
): ApolloEnrichmentRecoveryCompanySummary {
  const emails_recovered = Math.max(
    0,
    row.verified_email_contacts_after - row.verified_email_contacts_before,
  )

  return {
    company: row.company_name,
    company_candidate_id: row.company_candidate_id,
    strategy: row.strategy,
    bulk_match_invoked: bulkMatchInvokedFromCompanyResult(row),
    contacts_enriched: row.enrichment_candidates_updated,
    emails_recovered,
    verified_email_ready_before: row.verified_email_contacts_before > 0,
    verified_email_ready_after: row.verified_email_contacts_after > 0,
    blockers: row.blockers,
  }
}

function collectProviderBlockers(
  company_results: ApolloEnrichmentRecoveryCompanyResult[],
): string[] {
  const blockers = new Set<string>()
  for (const row of company_results) {
    for (const blocker of row.blockers) {
      if (PROVIDER_DISABLED_BLOCKERS.has(blocker)) blockers.add(blocker)
    }
  }
  return [...blockers]
}

function collectErrors(company_results: ApolloEnrichmentRecoveryCompanyResult[]): string[] {
  return company_results
    .flatMap((row) => row.blockers)
    .filter((blocker) => !PROVIDER_DISABLED_BLOCKERS.has(blocker))
}

export async function buildApolloEnrichmentRecoveryProductionReadiness(
  admin: SupabaseClient,
  input?: { env?: NodeJS.ProcessEnv },
): Promise<ReturnType<typeof buildApolloEnrichmentRecoveryReadinessPayload>> {
  void admin
  return buildApolloEnrichmentRecoveryReadinessPayload({ env: input?.env ?? process.env })
}

export async function executeApolloEnrichmentRecoveryInProduction(
  admin: SupabaseClient,
  input: ApolloEnrichmentRecoveryExecuteInput & {
    created_by?: string | null
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloEnrichmentRecoveryExecuteResult> {
  const env = input.env ?? process.env
  const gates = assertApolloEnrichmentRecoveryExecuteAllowed(env)
  const execution_id = randomUUID()
  const safety = {
    no_sends: true as const,
    no_outbound: true as const,
    no_sequence_execution: true as const,
    no_approval_bypass: true as const,
  }

  if (!gates.ok) {
    return redactApolloEnrichmentRecoverySecrets({
      ok: false,
      execution_id,
      dry_run: input.dry_run === true,
      error: "gates_failed",
      message: gates.error,
      blockers: gates.blockers,
      safety,
      recovery_results: {
        companies_targeted: 0,
        companies_processed: 0,
        companies_recovered: 0,
        contacts_enriched: 0,
        emails_recovered: 0,
        companies_promoted_to_verified: 0,
        errors: gates.blockers,
        provider_blockers: gates.blockers,
      },
      company_summaries: [],
      before_after: {
        verified_email_companies_before: 0,
        verified_email_companies_after: 0,
        qualified_companies_before: 0,
        qualified_companies_after: 0,
        greenfield_before: 0,
        greenfield_after: 0,
        yield_before_pct: 0,
        yield_after_pct: 0,
        net_improvement_pct: 0,
      },
      report: null,
    })
  }

  const report = await runApolloEnrichmentRecovery(admin, {
    dry_run: input.dry_run === true,
    limit: input.limit,
    offset: input.offset,
    skip_funnel_metrics: true,
    company_candidate_ids: input.company_candidate_ids?.length
      ? input.company_candidate_ids
      : undefined,
    stop_after_recovered_companies: input.stop_after_recovered_companies,
    created_by: input.created_by ?? null,
    env,
  })

  const company_summaries = report.company_results.map(companySummaryFromResult)
  const provider_blockers = collectProviderBlockers(report.company_results)
  const errors = collectErrors(report.company_results)

  return redactApolloEnrichmentRecoverySecrets({
    ok: true,
    execution_id,
    dry_run: input.dry_run === true,
    safety,
    recovery_results: {
      companies_targeted: report.companies_targeted,
      companies_processed: report.companies_processed,
      companies_recovered: report.companies_recovered,
      contacts_enriched: report.contacts_enriched,
      emails_recovered: report.emails_recovered,
      companies_promoted_to_verified: report.companies_promoted_to_verified,
      errors,
      provider_blockers,
    },
    company_summaries,
    before_after: {
      verified_email_companies_before: report.before.verified_email_companies,
      verified_email_companies_after: report.after.verified_email_companies,
      qualified_companies_before: report.before.qualified_companies,
      qualified_companies_after: report.after.qualified_companies,
      greenfield_before: report.before.greenfield_available,
      greenfield_after: report.after.greenfield_available,
      yield_before_pct: report.yield_before_pct,
      yield_after_pct: report.yield_after_pct,
      net_improvement_pct: report.net_improvement_pct,
    },
    report,
  })
}
