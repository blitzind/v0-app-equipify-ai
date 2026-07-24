/**
 * AVA-GROWTH-HOTFIX-2B-1A — Home critical executive load state (client-safe).
 * Distinguishes confirmed empty/active from loader unavailability.
 */

import type { GrowthHomeWorkspaceSummaryPayload } from "@/lib/growth/home/growth-home-workspace-summary-types"

export const AVA_GROWTH_HOTFIX_2B_1A_QA_MARKER = "ava-growth-hotfix-2b-1a-home-runtime-v1" as const

export const GROWTH_HOME_EXECUTIVE_UNAVAILABLE_MESSAGE =
  "Ava's latest briefing is still loading. Your existing work and approvals have not been cleared." as const

export const GROWTH_HOME_WORKSPACE_SUMMARY_CLIENT_TIMEOUT_MS = 12_000 as const

export const GROWTH_HOME_EXECUTIVE_SESSION_CACHE_KEY = "growth-home-executive-session-cache-v1" as const

export type GrowthHomeExecutiveSourceAvailability =
  | "confirmed"
  | "confirmed_empty"
  | "unavailable"

export type GrowthHomeExecutiveLoadMetadata = {
  qaMarker: typeof AVA_GROWTH_HOTFIX_2B_1A_QA_MARKER
  criticalStageMs: number
  secondaryStageMs: number | null
  approvals: GrowthHomeExecutiveSourceAvailability
  training: GrowthHomeExecutiveSourceAvailability
  activation: GrowthHomeExecutiveSourceAvailability
  missions: GrowthHomeExecutiveSourceAvailability
  recommendation: GrowthHomeExecutiveSourceAvailability
}

export function buildGrowthHomeExecutiveLoadMetadata(input: {
  criticalStageMs: number
  secondaryStageMs?: number | null
  approvals: GrowthHomeExecutiveSourceAvailability
  training?: GrowthHomeExecutiveSourceAvailability
  activation?: GrowthHomeExecutiveSourceAvailability
  missions?: GrowthHomeExecutiveSourceAvailability
  recommendation?: GrowthHomeExecutiveSourceAvailability
}): GrowthHomeExecutiveLoadMetadata {
  return {
    qaMarker: AVA_GROWTH_HOTFIX_2B_1A_QA_MARKER,
    criticalStageMs: input.criticalStageMs,
    secondaryStageMs: input.secondaryStageMs ?? null,
    approvals: input.approvals,
    training: input.training ?? "unavailable",
    activation: input.activation ?? "unavailable",
    missions: input.missions ?? "unavailable",
    recommendation: input.recommendation ?? "unavailable",
  }
}

export function isGrowthHomeExecutiveSourceUnavailable(
  availability: GrowthHomeExecutiveSourceAvailability | undefined,
): boolean {
  return availability === "unavailable"
}

export function isGrowthHomeExecutiveLoadDegraded(
  executiveLoad: GrowthHomeExecutiveLoadMetadata | null | undefined,
): boolean {
  if (!executiveLoad) return false
  return (
    executiveLoad.approvals === "unavailable" ||
    executiveLoad.training === "unavailable" ||
    executiveLoad.activation === "unavailable" ||
    executiveLoad.missions === "unavailable" ||
    executiveLoad.recommendation === "unavailable"
  )
}

export function resolveGrowthHomeExecutiveApprovalsAvailability(input: {
  loaded: boolean
  timedOut: boolean
  pendingApprovalCount: number
}): GrowthHomeExecutiveSourceAvailability {
  if (!input.loaded) {
    return input.timedOut ? "unavailable" : "confirmed_empty"
  }
  return input.pendingApprovalCount > 0 ? "confirmed" : "confirmed_empty"
}

export function readGrowthHomeExecutiveSessionCache(): GrowthHomeWorkspaceSummaryPayload | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(GROWTH_HOME_EXECUTIVE_SESSION_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as GrowthHomeWorkspaceSummaryPayload
    return parsed?.ok === true ? parsed : null
  } catch {
    return null
  }
}

export function writeGrowthHomeExecutiveSessionCache(
  payload: GrowthHomeWorkspaceSummaryPayload,
): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(GROWTH_HOME_EXECUTIVE_SESSION_CACHE_KEY, JSON.stringify(payload))
  } catch {
    // ignore quota / privacy errors
  }
}
