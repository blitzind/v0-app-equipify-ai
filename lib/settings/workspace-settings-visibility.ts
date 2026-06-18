/**
 * Workspace Settings visibility helpers (Phase GE-SET-2).
 *
 * Client-safe gates for Growth Engine and Data & Administration nav sections.
 * No network I/O — reads build-time public env and session identity already in context.
 */

/** Deployment kill switch mirrored for client bundles (see next.config.mjs). */
export function isGrowthEngineEnabledClient(): boolean {
  return process.env.NEXT_PUBLIC_GROWTH_ENGINE_ENABLED?.trim() === "true"
}

export type WorkspaceSettingsGrowthAccessInput = {
  /** Session identity from {@link useAdmin} — platform admin until org RBAC lands (Phase 2+). */
  isPlatformAdmin: boolean
}

/**
 * Whether the signed-in user can access Growth Engine workspace surfaces today.
 * Phase GE-SET-2: mirrors existing platform-admin gate; org operator RBAC deferred.
 */
export function resolveHasGrowthWorkspaceAccess(input: WorkspaceSettingsGrowthAccessInput): boolean {
  return input.isPlatformAdmin
}

export function isGrowthEngineSettingsNavVisible(input: WorkspaceSettingsGrowthAccessInput): boolean {
  return isGrowthEngineEnabledClient() && resolveHasGrowthWorkspaceAccess(input)
}

export function isDataAdministrationSettingsNavVisible(input: WorkspaceSettingsGrowthAccessInput): boolean {
  return input.isPlatformAdmin
}
