/** GE-AVA-MISSION-RUNTIME-1A — Persistent mission execution state (client-safe). */

export const GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER = "ge-ava-mission-runtime-1a-v1" as const

export const GROWTH_MISSION_RUNTIME_RULE =
  "Mission runtime orchestration reuses the existing GrowthObjective scheduler and audience/import/research services — no new scheduler or duplicate objective runtime." as const

export const GROWTH_MISSION_LIFECYCLE_STATES = [
  "planning",
  "monitoring",
  "finding_leads",
  "researching",
  "preparing_recommendations",
  "waiting_for_approval",
] as const

export type GrowthMissionLifecycleState = (typeof GROWTH_MISSION_LIFECYCLE_STATES)[number]

export type GrowthMissionRuntimeCounters = {
  newCompaniesFound: number
  recordsImported: number
  researchingCount: number
  draftsPrepared: number
  pendingApprovals: number
}

export type GrowthMissionRuntimeAudienceBinding = {
  audienceId: string
  refreshPolicy: "manual" | "daily" | "weekly"
  lastRefreshAt: string | null
  lastRefreshRunId: string | null
  lastSnapshotId: string | null
  lastAddedCount: number
}

export type GrowthMissionRuntimeDatamoonBinding = {
  lastRunId: string | null
  importRequestJson: string | null
  lastPollAt: string | null
  lastImportedCount: number
  /** GE-AVA-MISSION-RUNTIME-1B — Find Leads attachment metadata */
  provider?: "datamoon_audience"
  source?: "find_leads"
  searchSummary?: string | null
  audienceName?: string | null
  lookbackDays?: number | null
  intentLevels?: string[]
  onlyNewSinceLastRefresh?: boolean
  refreshCadence?: "daily" | "weekly"
  boundAt?: string | null
  keepMonitoring?: boolean
}

export type GrowthMissionRuntimeEvent = {
  id: string
  at: string
  summary: string
  lifecycleState: GrowthMissionLifecycleState
}

export type GrowthObjectiveMissionRuntimeState = {
  qa_marker: typeof GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER
  approved: boolean
  approvedAt: string | null
  lifecycleState: GrowthMissionLifecycleState
  activityLabel: string
  lastOrchestrationAt: string | null
  counters: GrowthMissionRuntimeCounters
  audience: GrowthMissionRuntimeAudienceBinding | null
  datamoon: GrowthMissionRuntimeDatamoonBinding | null
  events: GrowthMissionRuntimeEvent[]
}

export function createDefaultMissionRuntimeState(
  overrides?: Partial<GrowthObjectiveMissionRuntimeState>,
): GrowthObjectiveMissionRuntimeState {
  return {
    qa_marker: GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER,
    approved: false,
    approvedAt: null,
    lifecycleState: "planning",
    activityLabel: "Ava is planning this mission.",
    lastOrchestrationAt: null,
    counters: {
      newCompaniesFound: 0,
      recordsImported: 0,
      researchingCount: 0,
      draftsPrepared: 0,
      pendingApprovals: 0,
    },
    audience: null,
    datamoon: null,
    events: [],
    ...overrides,
  }
}

export function missionLifecycleStatusLabel(state: GrowthMissionLifecycleState): string {
  switch (state) {
    case "planning":
      return "Planning"
    case "monitoring":
      return "Monitoring"
    case "finding_leads":
      return "Finding Leads"
    case "researching":
      return "Researching"
    case "preparing_recommendations":
      return "Preparing Recommendations"
    case "waiting_for_approval":
      return "Waiting for Approval"
    default:
      return "In progress"
  }
}

export function missionLifecycleActivityLabel(
  state: GrowthMissionLifecycleState,
  counters: GrowthMissionRuntimeCounters,
): string {
  switch (state) {
    case "monitoring":
      return "Monitoring audience"
    case "finding_leads":
      return counters.newCompaniesFound > 0
        ? `Found ${counters.newCompaniesFound} new ${counters.newCompaniesFound === 1 ? "company" : "companies"}`
        : "Finding leads"
    case "researching":
      return counters.researchingCount > 0
        ? `Researching ${counters.researchingCount} ${counters.researchingCount === 1 ? "company" : "companies"}`
        : "Researching companies"
    case "preparing_recommendations":
      return "Preparing outreach drafts"
    case "waiting_for_approval":
      return "Waiting for approval"
    case "planning":
      return "Ava is planning this mission."
    default:
      return "Monitoring audience"
  }
}
