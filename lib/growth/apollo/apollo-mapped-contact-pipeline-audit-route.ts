/** Apollo mapping pipeline audit production route — evidence only. Server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  assertApolloMappingPipelineAuditExecuteAllowed,
  buildApolloMappingPipelineAuditReadinessPayload,
  redactApolloMappingPipelineAuditSecrets,
} from "@/lib/growth/apollo/apollo-mapped-contact-pipeline-audit-route-gates"
import { runApolloMappedContactPipelineAudit } from "@/lib/growth/apollo/apollo-mapped-contact-pipeline-audit-runner"

export async function buildApolloMappingPipelineAuditProductionReadiness(input?: {
  env?: NodeJS.ProcessEnv
}) {
  return buildApolloMappingPipelineAuditReadinessPayload({ env: input?.env ?? process.env })
}

export async function executeApolloMappingPipelineAuditInProduction(
  admin: SupabaseClient,
  input?: { env?: NodeJS.ProcessEnv },
) {
  const env = input?.env ?? process.env
  const gates = assertApolloMappingPipelineAuditExecuteAllowed(env)
  const execution_id = randomUUID()

  if (!gates.ok) {
    return redactApolloMappingPipelineAuditSecrets({
      ok: false,
      error: "gates_failed",
      message: gates.error,
      blockers: gates.blockers,
      execution_id,
      report: null,
    })
  }

  const report = await runApolloMappedContactPipelineAudit({ admin, env })
  return redactApolloMappingPipelineAuditSecrets({
    ok: true,
    execution_id,
    audited_at: new Date().toISOString(),
    safety: {
      enrollment: false,
      outreach: false,
      enrichment_pipeline: false,
      promotion_mutations: false,
    },
    report,
  })
}
