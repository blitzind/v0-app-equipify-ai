/** Apollo-Scale-2 production route orchestration — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildApolloScale2EvidenceBundle,
  type ApolloScale2EvidenceBundle,
} from "@/lib/growth/apollo/apollo-scale-2-evidence-bundle"
import type {
  ApolloScale2CertResult,
  ApolloScale2CompanyEvidenceRow,
  ApolloScale2FailureAnalysis,
} from "@/lib/growth/apollo/apollo-scale-2-live-acquisition-certification"
import {
  assertApolloScale2ProductionExecuteAllowed,
  buildApolloScale2ProductionReadinessPayload,
  redactApolloScale2ProductionSecrets,
} from "@/lib/growth/apollo/apollo-scale-2-production-route-gates"
import {
  certifyApolloScale2LiveAcquisition,
  resolveApolloScale2LiveCohort,
} from "@/lib/growth/apollo/apollo-scale-2-live-acquisition-certification"

export type { ApolloScale2ProductionReadinessPayload } from "@/lib/growth/apollo/apollo-scale-2-production-route-gates"
export { buildApolloScale2ProductionReadinessPayload } from "@/lib/growth/apollo/apollo-scale-2-production-route-gates"

export type ApolloScale2ProductionExecuteResult = {
  ok: boolean
  execution_id: string
  verdict: ApolloScale2CertResult | null
  companies: ApolloScale2CompanyEvidenceRow[]
  failure_analysis: ApolloScale2FailureAnalysis | null
  blockers: string[]
  error?: "gates_failed" | "cohort_failed" | "certification_failed"
  message?: string | null
  evidence_bundle: ApolloScale2EvidenceBundle | null
}

export async function buildApolloScale2ProductionReadiness(
  admin: SupabaseClient,
  input?: {
    env?: NodeJS.ProcessEnv
  },
): Promise<ReturnType<typeof buildApolloScale2ProductionReadinessPayload>> {
  const env = input?.env ?? process.env
  const gates = assertApolloScale2ProductionExecuteAllowed(env)

  let cohort_companies_selected = 0
  let cohort_companies: Array<{
    company_candidate_id: string
    company_name: string
    domain: string
  }> = []
  let cohort_error: string | null = null

  try {
    const cohort = await resolveApolloScale2LiveCohort(admin, {
      limit: gates.company_limit,
      env,
    })
    cohort_companies_selected = cohort.selected.length
    cohort_companies = cohort.selected.map((row) => ({
      company_candidate_id: row.company_candidate_id,
      company_name: row.company_name,
      domain: row.domain,
    }))
  } catch (error) {
    cohort_error = error instanceof Error ? error.message : String(error)
  }

  return buildApolloScale2ProductionReadinessPayload({
    cohort_companies_selected,
    cohort_companies,
    cohort_error,
    env,
  })
}

export async function executeApolloScale2InProduction(
  admin: SupabaseClient,
  input?: {
    company_limit?: number
    contact_limit?: number
    created_by?: string | null
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloScale2ProductionExecuteResult> {
  const env = input?.env ?? process.env
  const gates = assertApolloScale2ProductionExecuteAllowed(env)
  const execution_id = randomUUID()

  if (!gates.ok) {
    return redactApolloScale2ProductionSecrets({
      ok: false,
      error: "gates_failed",
      message: gates.error,
      blockers: gates.blockers,
      execution_id,
      verdict: null,
      companies: [],
      failure_analysis: null,
      evidence_bundle: null,
    })
  }

  try {
    await resolveApolloScale2LiveCohort(admin, {
      limit: input?.company_limit ?? gates.company_limit,
      env,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return redactApolloScale2ProductionSecrets({
      ok: false,
      error: "cohort_failed",
      message,
      blockers: [message],
      execution_id,
      verdict: null,
      companies: [],
      failure_analysis: null,
      evidence_bundle: null,
    })
  }

  const certification = await certifyApolloScale2LiveAcquisition(admin, {
    company_limit: input?.company_limit ?? gates.company_limit,
    contact_limit: input?.contact_limit,
    created_by: input?.created_by ?? null,
    env,
  })

  const evidence_bundle = buildApolloScale2EvidenceBundle({ certification })
  const ok = certification.result !== "FAIL"

  return redactApolloScale2ProductionSecrets({
    ok,
    execution_id,
    verdict: evidence_bundle.verdict,
    companies: evidence_bundle.companies,
    failure_analysis: evidence_bundle.failure_analysis,
    blockers: evidence_bundle.blockers,
    evidence_bundle,
    ...(ok
      ? {}
      : {
          error: "certification_failed" as const,
          message: `Apollo-Scale-2 certification result: ${certification.result}`,
        }),
  })
}
