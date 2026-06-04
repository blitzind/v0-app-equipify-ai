/** Client-safe discovery display status (7.4B operator + filters). */

import type { GrowthPhoneDiscoveryJobStatus } from "@/lib/growth/phone-discovery/phone-discovery-runtime-types"

export type GrowthPhoneDiscoveryDisplayStatus =
  | "none"
  | "pending"
  | "running"
  | "completed"
  | "failed"

/** Stale `running` threshold — worker and operator reads recover after this age. */
export const GROWTH_PHONE_DISCOVERY_STALE_RUNNING_MS = 30 * 60 * 1000

export const GROWTH_PHONE_DISCOVERY_STALE_RUNNING_ERROR =
  "stale_running_job_recovered_v1" as const

/**
 * Active queue job wins; else latest terminal job beats historical run.
 */
export function resolvePhoneDiscoveryDisplayStatus(input: {
  active_job_status: GrowthPhoneDiscoveryJobStatus | null
  latest_job_status: GrowthPhoneDiscoveryJobStatus | null
  last_run_status: string | null
}): GrowthPhoneDiscoveryDisplayStatus {
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

export function isPhoneDiscoveryDiscoveryFailed(
  discovery_status: GrowthPhoneDiscoveryDisplayStatus,
): boolean {
  return discovery_status === "failed"
}

export function isPhoneDiscoveryDiscoveryPending(
  discovery_status: GrowthPhoneDiscoveryDisplayStatus,
): boolean {
  return discovery_status === "pending" || discovery_status === "running"
}
