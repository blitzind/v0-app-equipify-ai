/**
 * Workspace Settings visibility helpers (Phase GE-SET-2).
 *
 * Client-safe gates for Growth Engine and Data & Administration nav sections.
 * No network I/O — reads session identity already in context.
 *
 * Equipify Growth plan ≠ Growth Engine access. Plan name is never used here.
 * NEXT_PUBLIC_GROWTH_ENGINE_ENABLED is a deployment/runtime gate only — not settings entitlement.
 */

/** Deployment kill switch mirrored for client bundles (see next.config.mjs). */
export function isGrowthEngineEnabledClient(): boolean {
  return process.env.NEXT_PUBLIC_GROWTH_ENGINE_ENABLED?.trim() === "true"
}

export type WorkspaceSettingsGrowthAccessInput = {
  /** Session identity from {@link useAdmin} — platform admin until org RBAC lands. */
  isPlatformAdmin: boolean
}

/**
 * Whether the signed-in user can access Growth Engine workspace surfaces today.
 * Phase GE-SET-2: platform admin only; org operator RBAC deferred.
 */
export function resolveHasGrowthWorkspaceAccess(input: WorkspaceSettingsGrowthAccessInput): boolean {
  return input.isPlatformAdmin === true
}

/**
 * Growth Engine + Growth Operator settings nav visibility.
 * Platform admin only for now — not gated by plan or NEXT_PUBLIC_GROWTH_ENGINE_ENABLED.
 */
export function isGrowthEngineSettingsNavVisible(input: WorkspaceSettingsGrowthAccessInput): boolean {
  return resolveHasGrowthWorkspaceAccess(input)
}

/** Alias for Growth Operator group under General — same gate as Growth Engine today. */
export function isGrowthOperatorSettingsNavVisible(input: WorkspaceSettingsGrowthAccessInput): boolean {
  return isGrowthEngineSettingsNavVisible(input)
}

export function isDataAdministrationSettingsNavVisible(input: WorkspaceSettingsGrowthAccessInput): boolean {
  return input.isPlatformAdmin === true
}

export const WORKSPACE_SETTINGS_VISIBILITY_QA_MARKER = "workspace-settings-visibility-v1" as const
