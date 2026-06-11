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
  resolveApolloScale3CertificationCohort,
  type ApolloScale3CompanyEvidenceRow,
  type ApolloScale3SearchStrategyCertification,
  type ApolloScale3CertificationCohortResolution,
  type ApolloScale3CohortPreset,
} from "@/lib/growth/apollo/apollo-scale-3-search-strategy-certification"
import type { ApolloScale2CertResult } from "@/lib/growth/apollo/apollo-scale-2-live-acquisition-certification"
import type { ApolloScale3CertFailReason, ApolloScale3CompanyCertWarningReason } from "@/lib/growth/apollo/apollo-scale-3-certification-assessment"
import { buildApolloSearchApiBudgetEvidence } from "@/lib/growth/apollo/apollo-search-api-budget-evidence"
import type { ApolloSearchApiBudgetEvidence } from "@/lib/growth/apollo/apollo-search-api-budget-evidence"
import { resolveApolloScale2CompanyLimit } from "@/lib/growth/apollo/apollo-scale-2-production-route-gates"
import {
  formatApolloScale5ExecutionFailure,
  formatApolloScale5ExecutionMessage,
  runApolloScale5ExecutionStage,
} from "@/lib/growth/apollo/apollo-scale-5-execution-errors"

const EMPTY_SCALE3_CERT_DIAGNOSTICS = {
  fail_reasons: [] as ApolloScale3CertFailReason[],
  warnings: [] as ApolloScale3CompanyCertWarningReason[],
  partial_company_fail_reasons: {} as Record<string, ApolloScale3CompanyCertWarningReason[]>,
}

export type ApolloScale3ProductionExecuteResult = {
  ok: boolean
  execution_id: string
  stage: string
  verdict: ApolloScale2CertResult | null
  companies: ApolloScale3CompanyEvidenceRow[]
  blockers: string[]
  failure_analysis: ApolloScale3SearchStrategyCertification["failure_analysis"] | null
  aggregate: ApolloScale3SearchStrategyCertification["aggregate"] | null
  error?: "gates_failed" | "cohort_failed" | "certification_failed" | "execution_failed"
  message?: string | null
  error_metadata?: { name: string; cause: string | null }
  stack?: string
  certification: ApolloScale3SearchStrategyCertification | null
  search_api_budget: ApolloSearchApiBudgetEvidence | null
  fail_reasons: ApolloScale3CertFailReason[]
  warnings: ApolloScale3CompanyCertWarningReason[]
  partial_company_fail_reasons: Record<string, ApolloScale3CompanyCertWarningReason[]>
  cohort_selection: ApolloScale3CertificationCohortResolution | null
}

function serializeApolloScale3ExecuteResult(
  payload: ApolloScale3ProductionExecuteResult,
  env: NodeJS.ProcessEnv,
): ApolloScale3ProductionExecuteResult {
  try {
    JSON.stringify(payload)
    return redactApolloScale3ProductionSecrets(payload)
  } catch (error) {
    const failure = formatApolloScale5ExecutionFailure({
      execution_id: payload.execution_id,
      stage: "response_serialization",
      error: "response_serialization_failed",
      message: formatApolloScale5ExecutionMessage(error),
      company: null,
      blockers: [...payload.blockers, "response_serialization_failed"],
      cause: error,
      env,
    })
    return redactApolloScale3ProductionSecrets({
      ok: false,
      execution_id: failure.execution_id,
      stage: failure.stage,
      verdict: null,
      companies: payload.companies,
      blockers: failure.blockers,
      failure_analysis: payload.failure_analysis,
      aggregate: payload.aggregate,
      error: "execution_failed",
      message: failure.message,
      error_metadata: failure.error_metadata,
      certification: payload.certification,
      search_api_budget: payload.search_api_budget ?? buildApolloSearchApiBudgetEvidence({ env }),
      fail_reasons: payload.fail_reasons ?? [],
      warnings: payload.warnings ?? [],
      partial_company_fail_reasons: payload.partial_company_fail_reasons ?? {},
      cohort_selection: payload.cohort_selection ?? null,
    })
  }
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
    const cohort = await resolveApolloScale3CertificationCohort(admin, {
      company_limit: gates.company_limit,
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
    company_names?: string[]
    company_candidate_ids?: string[]
    cohort_preset?: ApolloScale3CohortPreset
  },
): Promise<ApolloScale3ProductionExecuteResult> {
  const env = input?.env ?? process.env
  const execution_id = randomUUID()
  let stage = "readiness_gates"

  try {
    const gates = assertApolloScale3ProductionExecuteAllowed(env)
    if (!gates.ok) {
      return serializeApolloScale3ExecuteResult(
        {
          ok: false,
          stage,
          error: "gates_failed",
          message: gates.error,
          blockers: gates.blockers,
          execution_id,
          verdict: null,
          companies: [],
          failure_analysis: null,
          aggregate: null,
          certification: null,
          search_api_budget: buildApolloSearchApiBudgetEvidence({ env }),
          ...EMPTY_SCALE3_CERT_DIAGNOSTICS,
          cohort_selection: null,
        },
        env,
      )
    }

    const company_limit = input?.company_limit ?? gates.company_limit
    stage = "target_company_resolution"
    const cohortStage = await runApolloScale5ExecutionStage({
      stage: "target_company_resolution",
      run: () =>
        resolveApolloScale3CertificationCohort(admin, {
          company_limit,
          company_names: input?.company_names,
          company_candidate_ids: input?.company_candidate_ids,
          cohort_preset: input?.cohort_preset,
          env,
        }),
    })
    if (!cohortStage.ok) {
      const message = cohortStage.message
      return serializeApolloScale3ExecuteResult(
        {
          ok: false,
          stage: cohortStage.stage,
          error: "cohort_failed",
          message,
          blockers: [message],
          execution_id,
          verdict: null,
          companies: [],
          failure_analysis: null,
          aggregate: null,
          certification: null,
          search_api_budget: buildApolloSearchApiBudgetEvidence({ env }),
          ...EMPTY_SCALE3_CERT_DIAGNOSTICS,
          cohort_selection: null,
        },
        env,
      )
    }

    const cohort_resolution = cohortStage.value
    if (cohort_resolution.selected.length < 15) {
      const message = `Apollo-Scale-3 requires at least 15 companies; resolved ${cohort_resolution.selected.length}.`
      return serializeApolloScale3ExecuteResult(
        {
          ok: false,
          stage: "target_company_resolution",
          error: "cohort_failed",
          message,
          blockers: [message],
          execution_id,
          verdict: null,
          companies: [],
          failure_analysis: null,
          aggregate: null,
          certification: null,
          search_api_budget: buildApolloSearchApiBudgetEvidence({ env }),
          ...EMPTY_SCALE3_CERT_DIAGNOSTICS,
          cohort_selection: cohort_resolution,
        },
        env,
      )
    }

    stage = "apollo_search"
    const certificationStage = await runApolloScale5ExecutionStage({
      stage: "evidence_build",
      run: () =>
        certifyApolloScale3SearchStrategy(admin, {
          company_limit,
          contact_limit: input?.contact_limit,
          created_by: input?.created_by ?? null,
          env,
          company_names: input?.company_names,
          company_candidate_ids: input?.company_candidate_ids,
          cohort_preset: input?.cohort_preset,
          cohort_resolution,
        }),
    })
    if (!certificationStage.ok) {
      return serializeApolloScale3ExecuteResult(
        {
          ok: false,
          stage: certificationStage.stage,
          error: "execution_failed",
          message: certificationStage.message,
          blockers: [certificationStage.message],
          execution_id,
          verdict: null,
          companies: [],
          failure_analysis: null,
          aggregate: null,
          certification: null,
          search_api_budget: buildApolloSearchApiBudgetEvidence({ env }),
          ...EMPTY_SCALE3_CERT_DIAGNOSTICS,
          cohort_selection: cohort_resolution,
        },
        env,
      )
    }

    const certification = certificationStage.value
    stage = "completed"
    const blockers = certification.certification.failures_ranked.map(
      (row) => `${row.category} (${row.count})`,
    )
    const ok = certification.result === "PASS"

    return serializeApolloScale3ExecuteResult(
      {
        ok,
        execution_id,
        stage,
        verdict: certification.result,
        companies: certification.companies,
        blockers,
        failure_analysis: certification.failure_analysis,
        aggregate: certification.aggregate,
        certification,
        cohort_selection: certification.cohort_selection,
        fail_reasons: certification.certification_assessment.fail_reasons,
        warnings: certification.certification_assessment.warnings,
        partial_company_fail_reasons:
          certification.certification_assessment.partial_company_fail_reasons,
        search_api_budget: buildApolloSearchApiBudgetEvidence({
          env,
          company_limit,
          guardrails: {
            search_api_calls: certification.certification.runtime.api_calls,
            api_calls: certification.certification.runtime.api_calls,
            companies_acquired: certification.companies.length,
          },
        }),
        ...(ok
          ? {}
          : {
              error: "certification_failed" as const,
              message: `Apollo-Scale-3 certification result: ${certification.result}`,
            }),
      },
      env,
    )
  } catch (error) {
    const message = formatApolloScale5ExecutionMessage(error)
    return serializeApolloScale3ExecuteResult(
      {
        ok: false,
        execution_id,
        stage,
        error: "execution_failed",
        message,
        blockers: [message],
        verdict: null,
        companies: [],
        failure_analysis: null,
        aggregate: null,
        certification: null,
        search_api_budget: buildApolloSearchApiBudgetEvidence({ env }),
        ...EMPTY_SCALE3_CERT_DIAGNOSTICS,
        cohort_selection: null,
      },
      env,
    )
  }
}
