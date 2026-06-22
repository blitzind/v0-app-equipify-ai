/** GE-v1-2 — Operator setup health read model (client-safe). */

import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"

export const GE_V1_2_OPERATOR_SETUP_HEALTH_QA_MARKER = "ge-v1-2-operator-setup-health-v1" as const

export type GrowthOperatorSetupHealthStatus = "ok" | "warn" | "error" | "neutral"

export type GrowthOperatorSetupHealthItem = {
  id: string
  label: string
  value: number | string
  status: GrowthOperatorSetupHealthStatus
  href: string
  detail?: string | null
}

export type GrowthOperatorSetupHealthPayload = {
  qaMarker: typeof GE_V1_2_OPERATOR_SETUP_HEALTH_QA_MARKER
  generatedAt: string
  items: GrowthOperatorSetupHealthItem[]
  blockerCount: number
  warningCount: number
}

export const GROWTH_OPERATOR_SETUP_HEALTH_PATHS = {
  mailboxes: `${GROWTH_WORKSPACE_BASE_PATH}/settings/connected-mailboxes`,
  signatures: `${GROWTH_WORKSPACE_BASE_PATH}/settings/signatures`,
  calendar: `${GROWTH_WORKSPACE_BASE_PATH}/settings/calendar`,
  booking: `${GROWTH_WORKSPACE_BASE_PATH}/settings/booking`,
  personalizedVideos: `${GROWTH_WORKSPACE_BASE_PATH}/videos/personalized`,
  audiences: `${GROWTH_WORKSPACE_BASE_PATH}/audiences`,
  prospectSearch: `${GROWTH_WORKSPACE_BASE_PATH}/leads/lead-engine`,
  approvals: `${GROWTH_WORKSPACE_BASE_PATH}/campaigns/sequences`,
  runbook: `${GROWTH_WORKSPACE_BASE_PATH}/runbook`,
  settings: `${GROWTH_WORKSPACE_BASE_PATH}/settings`,
} as const
