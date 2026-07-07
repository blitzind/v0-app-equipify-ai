/** GE-AVA-MISSION-CENTER-1A — Mission Center API contract (client-safe). */

export {
  GROWTH_AVA_MISSION_CENTER_1A_QA_MARKER,
  GROWTH_MISSION_CENTER_RULE,
  GROWTH_MISSION_CENTER_ACTIVE_MISSIONS_TITLE,
} from "@/lib/growth/mission-center/growth-mission-center-types"

export const GROWTH_MISSION_CENTER_API_PATH = "/api/platform/growth/mission-center" as const

export const GROWTH_MISSION_BIND_FIND_LEADS_API_PATH =
  "/api/platform/growth/mission-center" as const

export function buildMissionBindFindLeadsApiPath(missionId: string): string {
  return `${GROWTH_MISSION_BIND_FIND_LEADS_API_PATH}/${missionId}/bind-find-leads`
}

export type GrowthMissionBindFindLeadsRequest = {
  datamoonRequest: import("@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types").DatamoonAudienceImportRequest
  searchSummary: string
  source: "find_leads"
  approvedByUser: true
  keepMonitoring?: boolean
  lastRunId?: string | null
  refreshCadence?: "daily" | "weekly"
}

export type GrowthMissionBindFindLeadsResponse = {
  ok: boolean
  qa_marker?: typeof import("@/lib/growth/mission-center/growth-mission-find-leads-binding-display").GROWTH_AVA_MISSION_RUNTIME_1B_QA_MARKER
  binding?: import("@/lib/growth/mission-center/growth-mission-find-leads-binding-service").MissionFindLeadsBindingSummary
  error?: string
}

export type { GrowthMissionCenterSourcesPayload } from "@/lib/growth/mission-center/growth-mission-center-types"
