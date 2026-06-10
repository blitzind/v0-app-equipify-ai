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

export type ApolloScale5ProductionExecuteResult = {
  ok: boolean
  execution_id: string
  verdict: ApolloScale5CertResult | null
  certification: ApolloScale5VerifiedEmailProductionCertification | null
  blockers: string[]
  error?: "gates_failed" | "target_company_failed" | "certification_failed"
  message?: string | null
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
  const gates = assertApolloScale5ProductionExecuteAllowed(env)
  const execution_id = randomUUID()

  if (!gates.ok) {
    return redactApolloScale5ProductionSecrets({
      ok: false,
      error: "gates_failed",
      message: gates.error,
      blockers: gates.blockers,
      execution_id,
      verdict: null,
      certification: null,
    })
  }

  let company: Awaited<ReturnType<typeof resolveMedicalEquipmentSolutionsCompany>>
  try {
    company = await resolveMedicalEquipmentSolutionsCompany(admin)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return redactApolloScale5ProductionSecrets({
      ok: false,
      error: "target_company_failed",
      message,
      blockers: [message],
      execution_id,
      verdict: null,
      certification: null,
    })
  }

  if (!company.company_candidate_id) {
    const message = "Medical Equipment Solutions company_candidate_id unresolved"
    return redactApolloScale5ProductionSecrets({
      ok: false,
      error: "target_company_failed",
      message,
      blockers: [message],
      execution_id,
      verdict: null,
      certification: null,
    })
  }

  const certification = await certifyApolloScale5VerifiedEmailPromotion(admin, {
    company_candidate_id: company.company_candidate_id,
    company_name: company.company_name,
    domain: company.domain,
    contact_limit: input?.contact_limit ?? gates.contact_limit,
    created_by: input?.created_by ?? null,
    env,
  })

  const ok = certification.result !== "FAIL"

  return redactApolloScale5ProductionSecrets({
    ok,
    execution_id,
    verdict: certification.result,
    certification,
    blockers: certification.blockers,
    ...(ok
      ? {}
      : {
          error: "certification_failed" as const,
          message: `Apollo-Scale-5 certification result: ${certification.result}`,
        }),
  })
}
