/** GE-AIOS-18G — Home mission discovery snapshot (client-safe read model). */

import type { GrowthHomeLeadPoolSummary } from "@/lib/growth/home/growth-home-lead-pool-pagination"
import {
  GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER,
  type GrowthMissionLifecycleState,
  type GrowthMissionRuntimeCounters,
} from "@/lib/growth/mission-center/growth-mission-runtime-types"
import type { GrowthObjective } from "@/lib/growth/objectives/growth-objective-types"
import { GROWTH_AVA_LAUNCH_MISSION_DEFAULT_OBJECTIVE_TYPE } from "@/lib/growth/workspace/executive-briefing/growth-home-launch-mission-setup-1a"
import { selectDefaultFindLeadsMissionId } from "@/lib/growth/mission-center/growth-mission-find-leads-binding-display"

export const GROWTH_HOME_MISSION_DISCOVERY_SNAPSHOT_18G_QA_MARKER =
  "ge-aios-18g-mission-discovery-snapshot-v1" as const

export type AutonomousLeadDiscoveryAction =
  | "run_prospect_search"
  | "refresh_audience"
  | "begin_research"
  | "prepare_outreach"
  | "follow_up"
  | "monitoring"
  | "idle"

export type GrowthHomeMissionDiscoverySnapshot = {
  qaMarker: typeof GROWTH_HOME_MISSION_DISCOVERY_SNAPSHOT_18G_QA_MARKER
  missionId: string | null
  lifecycleState: GrowthMissionLifecycleState
  activityLabel: string
  counters: GrowthMissionRuntimeCounters
  searchSummary: string | null
  audienceName: string | null
  recordsImported: number
  newCompaniesFound: number
  leadPoolVisible: number
  leadPoolHasMore: boolean
  pipelineLow: boolean
  lastEventSummary: string | null
  discoveryAction: AutonomousLeadDiscoveryAction
  startupDiscoveryReady: boolean
}

function selectAcquisitionMission(objectives: GrowthObjective[]): GrowthObjective | null {
  const active = objectives.filter(
    (entry) =>
      (entry.status === "active" || entry.status === "planning" || entry.runtime?.running) &&
      (entry.objectiveType === GROWTH_AVA_LAUNCH_MISSION_DEFAULT_OBJECTIVE_TYPE ||
        entry.objectiveType === "opportunities_created" ||
        entry.objectiveType === "pipeline_value" ||
        entry.objectiveType === "demos_booked" ||
        entry.objectiveType === "meetings_booked"),
  )
  const preferredId = selectDefaultFindLeadsMissionId(
    active.map((entry) => ({
      id: entry.id,
      title: entry.title,
      status: entry.status,
      objectiveType: entry.objectiveType,
      runtime: entry.runtime,
    })),
  )
  if (preferredId) {
    return active.find((entry) => entry.id === preferredId) ?? active[0] ?? null
  }
  return active[0] ?? null
}

export function resolveAutonomousLeadDiscoveryAction(input: {
  lifecycleState: GrowthMissionLifecycleState
  recordsImported: number
  newCompaniesFound: number
  leadPoolVisible: number
  leadPoolHasMore: boolean
  pipelineLow: boolean
  hasBoundSearch: boolean
  researchingCount: number
  pendingApprovals: number
}): AutonomousLeadDiscoveryAction {
  if (input.pendingApprovals > 0) return "prepare_outreach"
  if (input.lifecycleState === "researching" || input.researchingCount > 0) return "begin_research"
  if (input.lifecycleState === "preparing_recommendations") return "prepare_outreach"
  if (input.lifecycleState === "finding_leads") {
    return input.recordsImported === 0 ? "run_prospect_search" : "refresh_audience"
  }
  if (!input.hasBoundSearch) return "run_prospect_search"
  if (input.pipelineLow || (!input.leadPoolHasMore && input.leadPoolVisible > 0)) {
    return "refresh_audience"
  }
  if (input.recordsImported === 0 && input.leadPoolVisible === 0) return "run_prospect_search"
  if (input.recordsImported > 0 && input.leadPoolVisible > 0) return "begin_research"
  return input.lifecycleState === "monitoring" ? "monitoring" : "idle"
}

export function buildGrowthHomeMissionDiscoverySnapshot(input: {
  objectives: GrowthObjective[]
  leadPool?: GrowthHomeLeadPoolSummary | null
}): GrowthHomeMissionDiscoverySnapshot | null {
  const mission = selectAcquisitionMission(input.objectives)
  if (!mission) return null

  const runtime = mission.executionContext?.missionRuntime
  if (runtime?.qa_marker !== GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER) return null

  const hasBoundSearch = Boolean(runtime.datamoon?.importRequestJson?.trim() || runtime.audience?.audienceId)
  const leadPoolVisible = input.leadPool?.visible_count ?? 0
  const leadPoolHasMore = input.leadPool?.has_more === true
  const pipelineLow = leadPoolVisible > 0 && leadPoolVisible <= 25 && !leadPoolHasMore
  const recordsImported = runtime.counters.recordsImported ?? 0
  const newCompaniesFound = runtime.counters.newCompaniesFound ?? 0

  const discoveryAction = resolveAutonomousLeadDiscoveryAction({
    lifecycleState: runtime.lifecycleState,
    recordsImported,
    newCompaniesFound,
    leadPoolVisible,
    leadPoolHasMore,
    pipelineLow,
    hasBoundSearch,
    researchingCount: runtime.counters.researchingCount ?? 0,
    pendingApprovals: runtime.counters.pendingApprovals ?? 0,
  })

  return {
    qaMarker: GROWTH_HOME_MISSION_DISCOVERY_SNAPSHOT_18G_QA_MARKER,
    missionId: mission.id,
    lifecycleState: runtime.lifecycleState,
    activityLabel: runtime.activityLabel,
    counters: runtime.counters,
    searchSummary: runtime.datamoon?.searchSummary ?? null,
    audienceName: runtime.datamoon?.audienceName ?? null,
    recordsImported,
    newCompaniesFound,
    leadPoolVisible,
    leadPoolHasMore,
    pipelineLow,
    lastEventSummary: runtime.events[0]?.summary ?? null,
    discoveryAction,
    startupDiscoveryReady: runtime.approved === true && hasBoundSearch,
  }
}
