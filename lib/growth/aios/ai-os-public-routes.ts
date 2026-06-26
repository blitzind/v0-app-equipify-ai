/** GE-AIOS-URL-1 — Equipify AI OS public page routes (client-safe). */

import { resolveAiOsMissionIdParam } from "@/lib/growth/aios/ai-os-mission-route-params"

export const GROWTH_AIOS_URL_1_PHASE = "GE-AIOS-URL-1" as const

/** Canonical public UI namespace for Equipify AI OS. */
export const GROWTH_AI_OS_PUBLIC_BASE_PATH = "/growth/os" as const

/** Legacy public namespace — permanent redirects to {@link GROWTH_AI_OS_PUBLIC_BASE_PATH}. */
export const GROWTH_AI_OS_LEGACY_PUBLIC_BASE_PATH = "/growth/ai-os" as const

export function buildAiOsMissionPlanningHref(missionId: string | null | undefined): string | null {
  const resolved = resolveAiOsMissionIdParam(missionId)
  if (!resolved.ok) return null
  return `${GROWTH_AI_OS_PUBLIC_BASE_PATH}/missions/${resolved.missionId}/planning`
}

export function buildAiOsPilotLeadResearchHref(leadId: string | null | undefined): string | null {
  const trimmed = leadId?.trim() ?? ""
  if (!trimmed) return null
  return `${GROWTH_AI_OS_PUBLIC_BASE_PATH}/pilot/lead-research/${trimmed}`
}

/** Map a legacy `/growth/ai-os/*` pathname to the canonical `/growth/os/*` path. */
export function mapAiOsLegacyPublicPathToCanonical(pathname: string): string | null {
  if (!pathname.startsWith(GROWTH_AI_OS_LEGACY_PUBLIC_BASE_PATH)) return null
  if (pathname === GROWTH_AI_OS_LEGACY_PUBLIC_BASE_PATH) return GROWTH_AI_OS_PUBLIC_BASE_PATH
  return `${GROWTH_AI_OS_PUBLIC_BASE_PATH}${pathname.slice(GROWTH_AI_OS_LEGACY_PUBLIC_BASE_PATH.length)}`
}
