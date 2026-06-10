/** Apollo-Scale-5 production route orchestration — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveMedicalEquipmentSolutionsCompany } from "@/lib/growth/apollo/apollo-mapped-contact-pipeline-audit-runner"
import {
  assertApolloScale5ProductionExecuteAllowed,
  buildApolloScale5ProductionReadinessPayload,
  redactApolloScale5ProductionSecrets,
  type ApolloScale5CertResult,
} from "@/lib/growth/apollo/apollo-scale-5-production-route-gates"
import {
  certifyApolloScale5VerifiedEmailPromotion,
  type ApolloScale5VerifiedEmailProductionCertification,
} from "@/lib/growth/apollo/apollo-scale-5-verified-email-production-certification"
import {
  ApolloScale5StageError,
  formatApolloScale5ExecutionFailure,
  formatApolloScale5ExecutionMessage,
  resolveApolloScale5ExecutionStage,
  runApolloScale5ExecutionStage,
  type ApolloScale5ExecutionCompany,
  type ApolloScale5ExecutionErrorCode,
  type ApolloScale5ExecutionStage,
} from "@/lib/growth/apollo/apollo-scale-5-execution-errors"

export type ApolloScale5ProductionExecuteResult = {
  ok: boolean
  execution_id: string
  stage: ApolloScale5ExecutionStage
  company: ApolloScale5ExecutionCompany | null
  verdict: ApolloScale5CertResult | null
  certification: ApolloScale5VerifiedEmailProductionCertification | null
  blockers: string[]
  error?: ApolloScale5ExecutionErrorCode
  message?: string | null
  error_metadata?: { name: string; cause: string | null }
  stack?: string
}

function toCompanyContext(
  company: Awaited<ReturnType<typeof resolveMedicalEquipmentSolutionsCompany>> | null,
): ApolloScale5ExecutionCompany | null {
  if (!company) return null
  return {
    company_name: company.company_name,
    domain: company.domain ?? null,
    company_candidate_id: company.company_candidate_id || null,
  }
}

function serializeApolloScale5ExecuteResult(
  payload: ApolloScale5ProductionExecuteResult,
  env: NodeJS.ProcessEnv,
): ApolloScale5ProductionExecuteResult {
  try {
    JSON.stringify(payload)
    return redactApolloScale5ProductionSecrets(payload)
  } catch (error) {
    const failure = formatApolloScale5ExecutionFailure({
      execution_id: payload.execution_id,
      stage: "response_serialization",
      error: "response_serialization_failed",
      message: formatApolloScale5ExecutionMessage(error),
      company: payload.company,
      blockers: [...payload.blockers, "response_serialization_failed"],
      cause: error,
      env,
    })
    return redactApolloScale5ProductionSecrets(failure)
  }
}

export async function buildApolloScale5ProductionReadiness(
  admin: SupabaseClient,
  input?: { env?: NodeJS.ProcessEnv },
) {
  const env = input?.env ?? process.env
  let company_candidate_id: string | null = null
  let company_resolution_error: string | null = null

  try {
    const company = await resolveMedicalEquipmentSolutionsCompany(admin)
    company_candidate_id = company.company_candidate_id || null
    if (!company_candidate_id) {
      company_resolution_error = `Medical Equipment Solutions not found in growth.discovery_candidates`
    }
  } catch (error) {
    company_resolution_error = error instanceof Error ? error.message : String(error)
  }

  return buildApolloScale5ProductionReadinessPayload({
    company_candidate_id,
    company_resolution_error,
    env,
  })
}

export async function executeApolloScale5InProduction(
  admin: SupabaseClient,
  input?: {
    contact_limit?: number
    created_by?: string | null
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloScale5ProductionExecuteResult> {
  const env = input?.env ?? process.env
  const execution_id = randomUUID()
  let stage: ApolloScale5ExecutionStage = "readiness_gates"
  let companyContext: ApolloScale5ExecutionCompany | null = null

  try {
    const gates = assertApolloScale5ProductionExecuteAllowed(env)
    if (!gates.ok) {
      return serializeApolloScale5ExecuteResult(
        {
          ok: false,
          stage,
          error: "gates_failed",
          message: gates.error,
          blockers: gates.blockers,
          execution_id,
          company: null,
          verdict: null,
          certification: null,
        },
        env,
      )
    }

    stage = "target_company_resolution"
    const companyStage = await runApolloScale5ExecutionStage({
      stage,
      run: () => resolveMedicalEquipmentSolutionsCompany(admin),
    })
    if (!companyStage.ok) {
      throw new ApolloScale5StageError(stage, companyStage.message, { cause: companyStage.cause })
    }

    const company = companyStage.value
    companyContext = toCompanyContext(company)

    if (!company.company_candidate_id) {
      const message = "Medical Equipment Solutions company_candidate_id unresolved"
      return serializeApolloScale5ExecuteResult(
        {
          ok: false,
          stage,
          error: "target_company_failed",
          message,
          blockers: [message],
          execution_id,
          company: companyContext,
          verdict: null,
          certification: null,
        },
        env,
      )
    }

    stage = "apollo_search"
    const certificationStage = await runApolloScale5ExecutionStage({
      stage: "evidence_build",
      run: () =>
        certifyApolloScale5VerifiedEmailPromotion(admin, {
          company_candidate_id: company.company_candidate_id,
          company_name: company.company_name,
          domain: company.domain,
          contact_limit: input?.contact_limit ?? gates.contact_limit,
          created_by: input?.created_by ?? null,
          env,
        }),
    })
    if (!certificationStage.ok) {
      throw new ApolloScale5StageError(certificationStage.stage, certificationStage.message, {
        cause: certificationStage.cause,
      })
    }

    const certification = certificationStage.value
    stage = "completed"
    const ok = certification.result !== "FAIL"

    return serializeApolloScale5ExecuteResult(
      {
        ok,
        execution_id,
        stage,
        company: companyContext,
        verdict: certification.result,
        certification,
        blockers: certification.blockers,
        ...(ok
          ? {}
          : {
              error: "certification_failed" as const,
              message: `Apollo-Scale-5 certification result: ${certification.result}`,
            }),
      },
      env,
    )
  } catch (error) {
    const failedStage = resolveApolloScale5ExecutionStage(error)
    const message = formatApolloScale5ExecutionMessage(error)
    const failure = formatApolloScale5ExecutionFailure({
      execution_id,
      stage: failedStage,
      error: "execution_failed",
      message,
      company: companyContext,
      blockers: [message],
      cause: error,
      env,
    })
    return serializeApolloScale5ExecuteResult(failure, env)
  }
}

export {
  ApolloScale5StageError,
  formatApolloScale5ExecutionFailure,
  runApolloScale5ExecutionStage,
} from "@/lib/growth/apollo/apollo-scale-5-execution-errors"
