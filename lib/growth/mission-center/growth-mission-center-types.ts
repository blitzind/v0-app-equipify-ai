/** GE-AVA-MISSION-CENTER-1A — Unified Mission Center types (client-safe, read-model only). */

import type { GrowthObjectiveDashboardModel } from "@/lib/growth/objectives/growth-objective-types"
import type { GrowthRevenueDirectorCommandCenterSnapshot } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"
import type { BusinessProfileRecord } from "@/lib/growth/business-profile/business-profile-types"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"
import type { GrowthHomeMissionTimelineItem } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  AI_TEAMMATE_DEFAULT_NAME,
  resolveAiTeammatePresentation,
  type AiTeammatePresentation,
} from "@/lib/workspace/ai-teammate-identity"

export const GROWTH_AVA_MISSION_CENTER_1A_QA_MARKER = "ge-ava-mission-center-1a-v1" as const

export const GROWTH_MISSION_CENTER_RULE =
  "Mission Center aggregates existing GrowthObjective, Revenue Director, Human Approval, Business Profile, and Home read models — presentation only, no new runtime or planning engines." as const

export function growthMissionCenterActiveMissionsTitle(teammate: AiTeammatePresentation): string {
  return `${teammate.name}'s Active Missions`
}

export function growthMissionCenterActiveMissionsSubtitle(teammate: AiTeammatePresentation): string {
  return `Track the revenue missions ${teammate.name} is running for you.`
}

export function growthMissionCenterEmptyStateCopy(teammate: AiTeammatePresentation): string {
  return `When ${teammate.name} has an active revenue mission — research, leads, or outreach — it will appear here.`
}
const defaultTeammate = resolveAiTeammatePresentation(AI_TEAMMATE_DEFAULT_NAME)
export const GROWTH_MISSION_CENTER_ACTIVE_MISSIONS_TITLE = growthMissionCenterActiveMissionsTitle(defaultTeammate)
export const GROWTH_MISSION_CENTER_ACTIVE_MISSIONS_SUBTITLE = growthMissionCenterActiveMissionsSubtitle(defaultTeammate)
export const GROWTH_MISSION_CENTER_EMPTY_STATE_COPY = growthMissionCenterEmptyStateCopy(defaultTeammate)

export const GROWTH_MISSION_CENTER_PRESENTATION_STAGES = [
  "business_profile",
  "lead_discovery",
  "research",
  "qualification",
  "opportunity",
  "outreach_preparation",
  "approval",
  "execution",
  "learning",
] as const

export type GrowthMissionCenterPresentationStage = (typeof GROWTH_MISSION_CENTER_PRESENTATION_STAGES)[number]

export type GrowthMissionCenterHealth =
  | "healthy"
  | "needs_attention"
  | "blocked"
  | "waiting_on_you"
  | "completed"

export type GrowthMissionCenterControlKind =
  | "pause"
  | "resume"
  | "view_details"
  | "review_approvals"
  | "review_research"
  | "review_leads"

export type GrowthMissionCenterControl = {
  kind: GrowthMissionCenterControlKind
  label: string
  href: string
  disabled?: boolean
}

export type GrowthMissionCenterDetailSection = {
  id: string
  title: string
  status: "ready" | "in_progress" | "waiting" | "blocked" | "not_started"
  summary: string
  items: string[]
  advancedItems?: string[]
  href?: string
}

export type GrowthMissionCenterCard = {
  id: string
  name: string
  statusLabel: string
  progressPercent: number
  priority: "low" | "medium" | "high" | "critical"
  ownerLabel: string
  presentationStage: GrowthMissionCenterPresentationStage
  currentActivity: string
  waitingOn: string | null
  recommendedNextAction: string
  confidence: string
  health: GrowthMissionCenterHealth
  completedToday: string[]
  detailHref: string
  controls: GrowthMissionCenterControl[]
  blockedReason: string | null
  businessProfileBlocked: boolean
  sourceKind: "objective" | "revenue_heuristic" | "framework"
}

export type GrowthMissionCenterHealthSummary = {
  health: GrowthMissionCenterHealth
  count: number
  label: string
}

export type GrowthMissionCenterViewModel = {
  readOnly: true
  qaMarker: typeof GROWTH_AVA_MISSION_CENTER_1A_QA_MARKER
  generatedAt: string
  businessProfileApproved: boolean
  activeMissions: GrowthMissionCenterCard[]
  healthSummary: GrowthMissionCenterHealthSummary[]
  timeline: GrowthHomeMissionTimelineItem[]
  pendingApprovalCount: number
  approvalsHref: string
}

export type GrowthMissionCenterInput = {
  dashboard: GrowthWorkspaceDashboardViewModel
  objectiveDashboard?: GrowthObjectiveDashboardModel | null
  businessProfileApproved?: boolean
  revenueDirectorSnapshot?: GrowthRevenueDirectorCommandCenterSnapshot | null
  generatedAt?: string
}

export type GrowthMissionCenterSourcesPayload = {
  ok: boolean
  qaMarker?: typeof GROWTH_AVA_MISSION_CENTER_1A_QA_MARKER
  objectiveDashboard?: GrowthObjectiveDashboardModel
  businessProfile?: {
    schemaReady: boolean
    activeApproved: BusinessProfileRecord | null
  }
  revenueDirectorSnapshot?: GrowthRevenueDirectorCommandCenterSnapshot
  message?: string
}
