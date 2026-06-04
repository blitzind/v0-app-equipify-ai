/** Client-safe discovery display status (7.7B operator + filters). */

import type { GrowthBuyingCommitteeIntelligenceJobStatus } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-runtime-types"

export type { GrowthBuyingCommitteeIntelligenceDisplayStatus } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-runtime-types"

export const GROWTH_BUYING_COMMITTEE_INTELLIGENCE_STALE_RUNNING_MS = 30 * 60 * 1000

export const GROWTH_BUYING_COMMITTEE_INTELLIGENCE_STALE_RUNNING_ERROR =
  "stale_running_job_recovered_v1" as const

export function resolveBuyingCommitteeIntelligenceDisplayStatus(input: {
  active_job_status: GrowthBuyingCommitteeIntelligenceJobStatus | null
  latest_job_status: GrowthBuyingCommitteeIntelligenceJobStatus | null
  last_run_status: string | null
}): import("@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-runtime-types").GrowthBuyingCommitteeIntelligenceDisplayStatus {
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
