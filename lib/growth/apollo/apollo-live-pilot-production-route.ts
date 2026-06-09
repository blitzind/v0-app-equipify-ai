/** Apollo live pilot production route orchestration — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { certifyApolloProductionRollout } from "@/lib/growth/apollo/apollo-integration-ai-3-production-certification"
import { buildApolloLivePilotEvidenceBundle } from "@/lib/growth/apollo/apollo-live-pilot-evidence-bundle"
import type { ApolloLivePilotEvidenceBundle } from "@/lib/growth/apollo/apollo-live-pilot-evidence-bundle"
import { runApolloLivePilotAi2 } from "@/lib/growth/apollo/apollo-live-pilot-runner"
import { validateApolloLivePilotEvidence } from "@/lib/growth/apollo/apollo-live-pilot-evidence-types"
import {
  assertApolloLivePilotProductionExecuteAllowed,
  redactApolloLivePilotProductionSecrets,
} from "@/lib/growth/apollo/apollo-live-pilot-production-route-gates"

export type { ApolloLivePilotProductionReadinessPayload } from "@/lib/growth/apollo/apollo-live-pilot-production-route-gates"
export { buildApolloLivePilotProductionReadinessPayload } from "@/lib/growth/apollo/apollo-live-pilot-production-route-gates"

export type ApolloLivePilotProductionExecuteResult =
  | {
      ok: true
      execution_id: string
      company_candidate_id: string
      evidence_bundle: ApolloLivePilotEvidenceBundle
    }
  | {
      ok: false
      error: "gates_failed" | "pilot_failed" | "no_evidence"
      message: string | null
      execution_id?: string
      company_candidate_id?: string | null
      blockers?: string[]
      evidence_bundle: null
    }

export async function executeApolloLivePilotInProduction(
  admin: SupabaseClient,
  input: {
    userId: string
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloLivePilotProductionExecuteResult> {
  const env = input.env ?? process.env
  const gates = assertApolloLivePilotProductionExecuteAllowed(env)
  if (!gates.ok || !gates.company_candidate_id) {
    return {
      ok: false,
      error: "gates_failed",
      message: gates.error,
      blockers: gates.blockers,
      company_candidate_id: gates.company_candidate_id,
      evidence_bundle: null,
    }
  }

  const execution_id = randomUUID()
  const company_candidate_id = gates.company_candidate_id

  const pilot = await runApolloLivePilotAi2(admin, {
    company_candidate_id,
    created_by: input.userId,
    env,
  })

  if (!pilot.evidence) {
    return {
      ok: false,
      error: pilot.error ? "pilot_failed" : "no_evidence",
      message: pilot.error,
      execution_id,
      company_candidate_id,
      evidence_bundle: null,
    }
  }

  const validation = validateApolloLivePilotEvidence(pilot.evidence)
  const certification = certifyApolloProductionRollout({
    evidence: pilot.evidence,
    voice_drop_vd4_live_certified: env.APOLLO_VD4_LIVE_CERTIFIED === "true",
    compliance_orchestration_enabled: env.VOICE_COMPLIANCE_ORCHESTRATION_ENABLED === "true",
  })

  const evidence_bundle = buildApolloLivePilotEvidenceBundle({
    evidence: pilot.evidence,
    validation,
    certification: certification.certification,
    ok: pilot.ok && certification.ok && validation.ok,
  })

  return redactApolloLivePilotProductionSecrets({
    ok: pilot.ok && certification.ok && validation.ok,
    execution_id,
    company_candidate_id,
    evidence_bundle,
  })
}
