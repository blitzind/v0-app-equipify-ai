/** Apollo-Scale-5A contactable eligibility audit production route — evidence only. Server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { runApolloContactableEligibilityAudit } from "@/lib/growth/apollo/apollo-contactable-eligibility-audit-runner"
import {
  assertApolloScale5AExecuteAllowed,
  buildApolloScale5AReadinessPayload,
  redactApolloScale5ASecrets,
} from "@/lib/growth/apollo/apollo-scale-5a-production-route-gates"

export async function buildApolloScale5AProductionReadiness(input?: { env?: NodeJS.ProcessEnv }) {
  return buildApolloScale5AReadinessPayload({ env: input?.env ?? process.env })
}

export async function executeApolloScale5AInProduction(
  admin: SupabaseClient,
  input?: { env?: NodeJS.ProcessEnv },
) {
  const env = input?.env ?? process.env
  const gates = assertApolloScale5AExecuteAllowed(env)
  const execution_id = randomUUID()

  if (!gates.ok) {
    return redactApolloScale5ASecrets({
      ok: false,
      error: "gates_failed",
      message: gates.error,
      blockers: gates.blockers,
      execution_id,
      report: null,
    })
  }

  const report = await runApolloContactableEligibilityAudit({ admin })
  return redactApolloScale5ASecrets({
    ok: true,
    execution_id,
    audited_at: report.audited_at,
    safety: {
      enrollment: false,
      outreach: false,
      promotion_mutations: false,
      apollo_search: false,
    },
    report,
  })
}
