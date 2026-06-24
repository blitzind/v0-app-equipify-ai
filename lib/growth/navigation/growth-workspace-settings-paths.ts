/**
 * Growth workspace settings path helpers (client + server safe).
 */

import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"

export const GROWTH_WORKSPACE_SETTINGS_PATH_PREFIX = `${GROWTH_WORKSPACE_BASE_PATH}/settings` as const

export function isGrowthWorkspaceSettingsPathname(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/"
  if (normalized === GROWTH_WORKSPACE_SETTINGS_PATH_PREFIX) return true
  if (normalized.startsWith(`${GROWTH_WORKSPACE_SETTINGS_PATH_PREFIX}/`)) return true
  return /^\/growth\/settings(?:\/|$)/.test(normalized)
}
