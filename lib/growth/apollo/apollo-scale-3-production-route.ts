/** Apollo-Scale-3 production route orchestration — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  assertApolloScale3ProductionExecuteAllowed,
  buildApolloScale3ProductionReadinessPayload,
  redactApolloScale3ProductionSecrets,
} from "@/lib/growth/apollo/apollo-scale-3-production-route-gates"
import {
  certifyApolloScale3SearchStrategy,
  resolveApolloScale2LiveCohort,
  type ApolloScale3CompanyEvidenceRow,
  type ApolloScale3SearchStrategyCertification,
} from "@/lib/growth/apollo/apollo-scale-3-search-strategy-certification"
import type { ApolloScale2CertResult } from "@/lib/growth/apollo/apollo-scale-2-live-acquisition-certification"

export type ApolloScale3ProductionExecuteResult = {
  ok: boolean
  execution_id: string
  verdict: ApolloScale2CertResult | null
  companies: ApolloScale3CompanyEvidenceRow[]
  blockers: string[]
  error?: "gates_failed" | "cohort_failed" | "certification_failed"
  message?: string | null
  certification: ApolloScale3SearchStrategyCertification | null
}

export async function buildApolloScale3ProductionReadiness(
  admin: SupabaseClient,
  input?: { env?: NodeJS.ProcessEnv },
) {
  const env = input?.env ?? process.env
  const gates = assertApolloScale3ProductionExecuteAllowed(env)
  let cohort_companies_selected = 0
  let cohort_companies: Array<{ company_candidate_id: string; company_name: string; domain: string }> = []
  let cohort_error: string | null = null
  try {
    const cohort = await resolveApolloScale2LiveCohort(admin, { limit: gates.company_limit, env })
    cohort_companies_selected = cohort.selected.length
    cohort_companies = cohort.selected.map((row) => ({
      company_candidate_id: row.company_candidate_id,
      company_name: row.company_name,
      domain: row.domain,
    }))
  } catch (error) {
    cohort_error = error instanceof Error ? error.message : String(error)
  }
  return buildApolloScale3ProductionReadinessPayload({
    cohort_companies_selected,
    cohort_companies,
    cohort_error,
    env,
  })
}

export async function executeApolloScale3InProduction(
  admin: SupabaseClient,
  input?: {
    company_limit?: number
    contact_limit?: number
    created_by?: string | null
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloScale3ProductionExecuteResult> {
  const env = input?.env ?? process.env
  const gates = assertApolloScale3ProductionExecuteAllowed(env)
  const execution_id = randomUUID()

  if (!gates.ok) {
    return redactApolloScale3ProductionSecrets({
      ok: false,
      error: "gates_failed",
      message: gates.error,
      blockers: gates.blockers,
      execution_id,
      verdict: null,
      companies: [],
      certification: null,
    })
  }

  try {
    await resolveApolloScale2LiveCohort(admin, {
      limit: input?.company_limit ?? gates.company_limit,
      env,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return redactApolloScale3ProductionSecrets({
      ok: false,
      error: "cohort_failed",
      message,
      blockers: [message],
      execution_id,
      verdict: null,
      companies: [],
      certification: null,
    })
  }

  const certification = await certifyApolloScale3SearchStrategy(admin, {
    company_limit: input?.company_limit ?? gates.company_limit,
    contact_limit: input?.contact_limit,
    created_by: input?.created_by ?? null,
    env,
  })

  const blockers = certification.certification.failures_ranked.map(
    (row) => `${row.category} (${row.count})`,
  )
  const ok = certification.result !== "FAIL"

  return redactApolloScale3ProductionSecrets({
    ok,
    execution_id,
    verdict: certification.result,
    companies: certification.companies,
    blockers,
    certification,
    ...(ok
      ? {}
      : {
          error: "certification_failed" as const,
          message: `Apollo-Scale-3 certification result: ${certification.result}`,
        }),
  })
}
