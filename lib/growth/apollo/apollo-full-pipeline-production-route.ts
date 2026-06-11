/** Apollo Full Pipeline Production Certification route — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { certifyApolloFullPipelineProduction } from "@/lib/growth/apollo/apollo-full-pipeline-production-certification"
import type { ApolloFullPipelineProductionCertificationExecuteResult } from "@/lib/growth/apollo/apollo-full-pipeline-production-certification-types"
import {
  assertApolloFullPipelineProductionCertificationAllowed,
  buildApolloFullPipelineProductionCertificationReadinessPayload,
  redactApolloFullPipelineProductionCertificationSecrets,
} from "@/lib/growth/apollo/apollo-full-pipeline-production-route-gates"

export async function buildApolloFullPipelineProductionCertificationReadiness(
  admin: SupabaseClient,
  input?: { env?: NodeJS.ProcessEnv; company_candidate_id?: string | null },
) {
  return buildApolloFullPipelineProductionCertificationReadinessPayload({
    env: input?.env ?? process.env,
    company_candidate_id: input?.company_candidate_id ?? null,
  })
}

export async function executeApolloFullPipelineProductionCertification(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    enrollment_candidate_id?: string | null
    actor_user_id?: string | null
    actor_email?: string | null
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloFullPipelineProductionCertificationExecuteResult> {
  const env = input.env ?? process.env
  const execution_id = randomUUID()
  const gates = assertApolloFullPipelineProductionCertificationAllowed(env)

  if (!gates.ok) {
    return redactApolloFullPipelineProductionCertificationSecrets({
      ok: false,
      execution_id,
      certification: null,
      blockers: gates.blockers,
      error: "gates_failed",
      message: gates.error,
    })
  }

  try {
    const certification = await certifyApolloFullPipelineProduction(admin, {
      execution_id,
      company_candidate_id: input.company_candidate_id,
      enrollment_candidate_id: input.enrollment_candidate_id ?? null,
      actor_user_id: input.actor_user_id ?? null,
      actor_email: input.actor_email ?? null,
      env,
    })

    return redactApolloFullPipelineProductionCertificationSecrets({
      ok: certification.certified,
      execution_id,
      certification,
      blockers: certification.blockers,
      ...(certification.certified
        ? {}
        : {
            error: "certification_failed" as const,
            message: certification.summary,
          }),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return redactApolloFullPipelineProductionCertificationSecrets({
      ok: false,
      execution_id,
      certification: null,
      blockers: [message],
      error: "certification_failed",
      message,
    })
  }
}
