/** Apollo search query audit production route — evidence only. Server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  assertApolloSearchQueryAuditExecuteAllowed,
  buildApolloSearchQueryAuditReadinessPayload,
  redactApolloSearchQueryAuditSecrets,
} from "@/lib/growth/apollo/apollo-search-query-audit-route-gates"
import {
  resolveApolloSearchQueryAuditCompanies,
  runApolloSearchQueryAudit,
} from "@/lib/growth/apollo/apollo-search-query-audit-runner"

export async function buildApolloSearchQueryAuditProductionReadiness(
  admin: SupabaseClient,
  input?: { env?: NodeJS.ProcessEnv },
) {
  const env = input?.env ?? process.env
  assertApolloSearchQueryAuditExecuteAllowed(env)
  let cohort_error: string | null = null
  let resolved_companies: Array<{ company_name: string; domain: string }> = []
  try {
    const companies = await resolveApolloSearchQueryAuditCompanies(admin)
    resolved_companies = companies.map((row) => ({
      company_name: row.company_name,
      domain: row.domain,
    }))
  } catch (error) {
    cohort_error = error instanceof Error ? error.message : String(error)
  }
  return buildApolloSearchQueryAuditReadinessPayload({
    cohort_error,
    resolved_companies,
    env,
  })
}

export async function executeApolloSearchQueryAuditInProduction(
  admin: SupabaseClient,
  input?: { created_by?: string | null; env?: NodeJS.ProcessEnv },
) {
  const env = input?.env ?? process.env
  const gates = assertApolloSearchQueryAuditExecuteAllowed(env)
  const execution_id = randomUUID()

  if (!gates.ok) {
    return redactApolloSearchQueryAuditSecrets({
      ok: false,
      error: "gates_failed",
      message: gates.error,
      blockers: gates.blockers,
      execution_id,
      companies: [],
      summary: [],
    })
  }

  const companies = await resolveApolloSearchQueryAuditCompanies(admin)
  const audit = await runApolloSearchQueryAudit({ companies, env })

  return redactApolloSearchQueryAuditSecrets({
    ok: audit.ok,
    execution_id,
    audited_at: audit.audited_at,
    mock: audit.mock,
    safety: {
      enrollment: false,
      outreach: false,
      enrichment_pipeline: false,
    },
    companies: audit.companies,
    summary: audit.summary,
  })
}
