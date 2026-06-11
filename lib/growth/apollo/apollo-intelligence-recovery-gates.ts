/** Apollo intelligence recovery gates — client-safe. */

function isGrowthEngineEnabledEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.GROWTH_ENGINE_ENABLED?.trim() === "true"
}

export const APOLLO_INTELLIGENCE_RECOVERY_EXECUTE_CONFIRM = "RUN_APOLLO_INTELLIGENCE_RECOVERY" as const

export const APOLLO_INTELLIGENCE_RECOVERY_GATES_QA_MARKER =
  "apollo-intelligence-recovery-gates-v14-2" as const

export function validateApolloIntelligenceRecoveryConfirmation(
  body: unknown,
): { ok: true } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body required with confirm_token." }
  }
  const record = body as Record<string, unknown>
  const token =
    typeof record.confirm_token === "string"
      ? record.confirm_token.trim()
      : typeof record.confirmation === "string"
        ? record.confirmation.trim()
        : ""
  if (token !== APOLLO_INTELLIGENCE_RECOVERY_EXECUTE_CONFIRM) {
    return {
      ok: false,
      error: `confirm_token must be ${APOLLO_INTELLIGENCE_RECOVERY_EXECUTE_CONFIRM}`,
    }
  }
  return { ok: true }
}

export function assertApolloIntelligenceRecoveryEnvAllowed(
  env: NodeJS.ProcessEnv = process.env,
): { ok: boolean; blockers: string[] } {
  const blockers: string[] = []
  if (!isGrowthEngineEnabledEnv()) {
    blockers.push("GROWTH_ENGINE_ENABLED must be true")
  }
  return { ok: blockers.length === 0, blockers }
}
