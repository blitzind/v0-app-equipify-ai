import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GovernancePolicyBlockedError,
  isGovernanceSchemaReadyForEnforcement,
  runGovernanceGateWithAudit,
  type GovernanceEvaluationInput,
} from "@/lib/growth/governance/policy-engine"

export { GovernancePolicyBlockedError }

export async function enforceGovernanceIfReady(
  admin: SupabaseClient,
  input: GovernanceEvaluationInput & {
    entityType: string
    entityId?: string | null
    recordAudit?: boolean
  },
): Promise<void> {
  if (!(await isGovernanceSchemaReadyForEnforcement(admin))) return
  await runGovernanceGateWithAudit(admin, input)
}

export function governanceBlockedMessage(error: unknown): string {
  if (error instanceof GovernancePolicyBlockedError) {
    return error.violations[0]?.message ?? "governance_policy_blocked"
  }
  if (error instanceof Error) return error.message
  return "governance_policy_blocked"
}
