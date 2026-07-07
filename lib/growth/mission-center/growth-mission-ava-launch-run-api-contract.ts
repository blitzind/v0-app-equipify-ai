/** GE-AVA-AUTONOMY-LAUNCH-RUN-1 — Ava launch run API contract (client-safe). */

import type { AvaDatamoonAudienceDraft } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import type { MissionFindLeadsBindingSummary } from "@/lib/growth/mission-center/growth-mission-find-leads-binding-service"

export const GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER = "ge-ava-autonomy-launch-run-1-v1" as const

export const GROWTH_AVA_LAUNCH_RUN_TITLE = "Run Ava" as const
export const GROWTH_AVA_LAUNCH_RUN_DESCRIPTION =
  "Find leads from your approved search, import them, start research, and surface items for human approval — no outbound send." as const
export const GROWTH_AVA_LAUNCH_RUN_SUCCESS_COPY =
  "Ava launch run complete. Review imported leads and pending approvals before outreach." as const

export function buildMissionAvaLaunchRunApiPath(missionId: string): string {
  return `/api/platform/growth/mission-center/${encodeURIComponent(missionId)}/ava-launch-run`
}

export type GrowthMissionAvaLaunchRunRequest = {
  audienceDraft: AvaDatamoonAudienceDraft
  searchSummary: string
  approvedByUser: true
  keepMonitoring?: boolean
  refreshCadence?: "daily" | "weekly"
}

export type GrowthMissionAvaLaunchRunLeadResearchStatus = {
  leadId: string
  workflowStatus: string | null
  researchPilotEnabled: boolean
}

export type GrowthMissionAvaLaunchRunHumanApprovalSummary = {
  totalPending: number
  topItems: Array<{
    id: string
    title: string
    channel: string
    href: string | null
    leadId: string | null
  }>
  approvalsHref: "/growth/os/approvals"
}

export type GrowthMissionAvaLaunchRunResult = {
  qa_marker: typeof GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER
  missionId: string
  runId: string
  binding: MissionFindLeadsBindingSummary
  import: {
    imported: number
    duplicates: number
    skipped: number
    errors: number
    leadIds: string[]
    previewCount: number
  }
  research: {
    pilotEnabled: boolean
    leads: GrowthMissionAvaLaunchRunLeadResearchStatus[]
  }
  humanApprovalCenter: GrowthMissionAvaLaunchRunHumanApprovalSummary
  stoppedAt: "human_approval"
}

export type GrowthMissionAvaLaunchRunResponse =
  | { ok: true; result: GrowthMissionAvaLaunchRunResult }
  | { ok: false; qa_marker: typeof GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER; error: string }
