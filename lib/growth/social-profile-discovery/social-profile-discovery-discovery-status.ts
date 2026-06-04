/** Client-safe discovery display status (7.5B operator + filters). */

import type { GrowthSocialProfileDiscoveryJobStatus } from "@/lib/growth/social-profile-discovery/social-profile-discovery-runtime-types"

export type GrowthSocialProfileDiscoveryDisplayStatus =
  | "none"
  | "pending"
  | "running"
  | "completed"
  | "failed"

export const GROWTH_SOCIAL_PROFILE_DISCOVERY_STALE_RUNNING_MS = 30 * 60 * 1000

export const GROWTH_SOCIAL_PROFILE_DISCOVERY_STALE_RUNNING_ERROR =
  "stale_running_job_recovered_v1" as const

export function resolveSocialProfileDiscoveryDisplayStatus(input: {
  active_job_status: GrowthSocialProfileDiscoveryJobStatus | null
  latest_job_status: GrowthSocialProfileDiscoveryJobStatus | null
  last_run_status: string | null
}): GrowthSocialProfileDiscoveryDisplayStatus {
  const active = input.active_job_status
  if (active === "pending") return "pending"
  if (active === "running") return "running"

  const latest = input.latest_job_status
  if (latest === "failed") return "failed"
  if (latest === "completed") return "completed"
  if (latest === "pending") return "pending"
  if (latest === "running") return "running"

  const run = (input.last_run_status ?? "").trim().toLowerCase()
  if (run === "failed") return "failed"
  if (run === "completed" || run === "partial") return "completed"
  return "none"
}

export function isSocialProfileDiscoveryPending(
  discovery_status: GrowthSocialProfileDiscoveryDisplayStatus,
): boolean {
  return discovery_status === "pending" || discovery_status === "running"
}
