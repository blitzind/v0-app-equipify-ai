/** Apollo-Primary-1 production route orchestration — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  assertApolloPrimaryContactAcquisitionAllowed,
  buildApolloPrimaryContactAcquisitionReadinessPayload,
  redactApolloPrimaryContactAcquisitionSecrets,
} from "@/lib/growth/apollo/apollo-primary-contact-acquisition-gates"
import {
  runApolloPrimaryContactAcquisition,
  type ApolloPrimaryContactAcquisitionEvidence,
} from "@/lib/growth/apollo/apollo-primary-contact-acquisition"

export type { ApolloPrimaryContactAcquisitionReadinessPayload } from "@/lib/growth/apollo/apollo-primary-contact-acquisition-gates"
export { buildApolloPrimaryContactAcquisitionReadinessPayload } from "@/lib/growth/apollo/apollo-primary-contact-acquisition-gates"

export type ApolloPrimaryContactAcquisitionExecuteResult = {
  ok: boolean
  execution_id: string
  company_candidate_id: string
  error?: "gates_failed" | "acquisition_failed" | "no_evidence"
  message?: string | null
  blockers?: string[]
  evidence: ApolloPrimaryContactAcquisitionEvidence | null
}

export async function buildApolloPrimaryContactAcquisitionProductionReadiness(
  admin: SupabaseClient,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ReturnType<typeof buildApolloPrimaryContactAcquisitionReadinessPayload>> {
  void admin
  return buildApolloPrimaryContactAcquisitionReadinessPayload({ env })
}

export async function executeApolloPrimaryContactAcquisitionInProduction(
  admin: SupabaseClient,
  input?: {
    company_candidate_id?: string
    contact_limit?: number
    created_by?: string | null
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloPrimaryContactAcquisitionExecuteResult> {
  const env = input?.env ?? process.env
  const gates = assertApolloPrimaryContactAcquisitionAllowed(env)
  const company_candidate_id =
    input?.company_candidate_id?.trim() || gates.company_candidate_id
  const contact_limit = input?.contact_limit ?? gates.contact_limit

  if (!gates.ok) {
    return {
      ok: false,
      error: "gates_failed",
      message: gates.error,
      blockers: gates.blockers,
      company_candidate_id,
      execution_id: randomUUID(),
      evidence: null,
    }
  }

  const execution_id = randomUUID()

  const evidence = await runApolloPrimaryContactAcquisition(admin, {
    company_candidate_ids: [company_candidate_id],
    contact_limit,
    created_by: input?.created_by ?? null,
    env,
  })

  const company = evidence.companies[0]
  const ok =
    Boolean(company) &&
    evidence.runtime.errors.length === 0 &&
    (company.promoted_contacts > 0 ||
      company.existing_contactable_before > 0 ||
      company.apollo_people_found > 0)

  return redactApolloPrimaryContactAcquisitionSecrets({
    ok,
    execution_id,
    company_candidate_id,
    evidence,
    ...(ok
      ? {}
      : {
          error: "acquisition_failed" as const,
          message:
            company?.blockers[0] ??
            evidence.blockers[0] ??
            evidence.runtime.errors[0] ??
            "Apollo-Primary-1 contact acquisition did not produce usable contacts.",
          blockers: company?.blockers ?? evidence.blockers,
        }),
  })
}
