/**
 * GE-AIOS-UX-1A — Workspace-first operator navigation feature flag (client-safe).
 */

export const GROWTH_WORKSPACE_FIRST_UX_1A_QA_MARKER =
  "ge-aios-ux-1a-workspace-first-operator-navigation-v1" as const

export const GROWTH_WORKSPACE_FIRST_UX_1A_FEATURE_FLAG =
  "GROWTH_WORKSPACE_FIRST_UX_1A_ENABLED" as const

export const GROWTH_WORKSPACE_FIRST_UX_1A_PUBLIC_FEATURE_FLAG =
  "NEXT_PUBLIC_GROWTH_WORKSPACE_FIRST_UX_1A_ENABLED" as const

function isTruthyFlag(value: string | undefined): boolean {
  if (!value) return false
  const raw = value.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

/** Server / build-time flag — defaults off so legacy nav remains canonical until rollout. */
export function isGrowthWorkspaceFirstUx1aEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return isTruthyFlag(env[GROWTH_WORKSPACE_FIRST_UX_1A_FEATURE_FLAG])
}

/**
 * Build-time inlined public flag — literal env access only (no bare identifier names).
 * Absent/unset values resolve to false.
 */
export const GROWTH_WORKSPACE_FIRST_UX_1A_PUBLIC_ENABLED = isTruthyFlag(
  process.env.NEXT_PUBLIC_GROWTH_WORKSPACE_FIRST_UX_1A_ENABLED,
)

/** Client flag for workspace shell nav — mirrors server when set at build time. */
export function isGrowthWorkspaceFirstUx1aEnabledClient(): boolean {
  return GROWTH_WORKSPACE_FIRST_UX_1A_PUBLIC_ENABLED
}
