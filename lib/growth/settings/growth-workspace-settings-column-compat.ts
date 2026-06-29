/** PostgREST / Postgres missing-column detection for operator_workspace_preferences. */

export const GROWTH_OPERATOR_WORKSPACE_AI_TEAMMATE_ONBOARDING_COLUMN =
  "ai_teammate_onboarding_completed" as const

export function isGrowthOperatorWorkspaceMissingColumnError(
  error: { message?: string; code?: string } | null | undefined,
  column = GROWTH_OPERATOR_WORKSPACE_AI_TEAMMATE_ONBOARDING_COLUMN,
): boolean {
  if (!error) return false
  const message = typeof error.message === "string" ? error.message : String(error)
  const code = typeof error.code === "string" ? error.code : ""
  if (code === "42703" || code === "PGRST204") return true
  return new RegExp(`column .*${column}.* does not exist`, "i").test(message)
}

export function isGrowthOrganizationAiTeammateIdentityTableMissingError(
  error: { message?: string; code?: string } | null | undefined,
): boolean {
  if (!error) return false
  const message = typeof error.message === "string" ? error.message : String(error)
  const code = typeof error.code === "string" ? error.code : ""
  return (
    code === "PGRST205" ||
    /Could not find the table 'growth\.organization_ai_teammate_identity'/i.test(message)
  )
}
