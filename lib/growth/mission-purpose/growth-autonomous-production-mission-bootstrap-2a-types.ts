/** GE-AIOS-LIVE-2A — Autonomous production mission bootstrap types (client-safe). */

import type { GrowthMissionPurpose } from "@/lib/growth/mission-purpose/growth-mission-purpose-1a-types"

export const GROWTH_AUTONOMOUS_PRODUCTION_MISSION_BOOTSTRAP_2A_QA_MARKER =
  "ge-aios-live-2a-autonomous-production-mission-bootstrap-v1" as const

export const GE_AIOS_LIVE_2A_PRODUCTION_MISSION_OBJECTIVE =
  "Maintain a healthy portfolio of qualified companies by continuously discovering, researching, qualifying, and preparing outreach opportunities that match the approved Growth Profile." as const

export type ProductionMissionBootstrapAction =
  | "skipped"
  | "already_active"
  | "created"
  | "resumed"
  | "bound_search"
  | "blocked"

export type ProductionMissionBootstrapResult = {
  qaMarker: typeof GROWTH_AUTONOMOUS_PRODUCTION_MISSION_BOOTSTRAP_2A_QA_MARKER
  organizationId: string
  action: ProductionMissionBootstrapAction
  objectiveId: string | null
  missionPurpose: GrowthMissionPurpose | null
  portfolioDeficit: number
  reason: string | null
  discoveryProvider: "datamoon" | null
}

export type ProductionMissionBootstrapSchedulerTickResult = {
  qaMarker: typeof GROWTH_AUTONOMOUS_PRODUCTION_MISSION_BOOTSTRAP_2A_QA_MARKER
  organizationsAttempted: number
  organizationsBootstrapped: number
  results: ProductionMissionBootstrapResult[]
}
