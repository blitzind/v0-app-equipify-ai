/** GE-AIOS-18D — Canonical “Get Ava Ready” startup experience (client-safe). */

import type {
  GrowthAutonomyApprovalPolicy,
  GrowthAutonomyCapability,
} from "@/lib/growth/autonomy/growth-autonomy-types"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import {
  HOME_LIVING_GET_AVA_READY_COMPLETE_COPY,
  HOME_LIVING_GET_AVA_READY_DESCRIPTION,
  HOME_LIVING_GET_AVA_READY_TITLE,
} from "@/lib/growth/home/growth-home-living-experience-18e"

export const GROWTH_HOME_CANONICAL_STARTUP_EXPERIENCE_18D_QA_MARKER =
  "ge-aios-18d-canonical-startup-experience-v1" as const

export const GROWTH_HOME_GET_AVA_READY_TITLE = HOME_LIVING_GET_AVA_READY_TITLE

export const GROWTH_HOME_GET_AVA_READY_DESCRIPTION = HOME_LIVING_GET_AVA_READY_DESCRIPTION

export const GROWTH_HOME_GET_AVA_READY_COMPLETE_COPY = HOME_LIVING_GET_AVA_READY_COMPLETE_COPY

export const GROWTH_HOME_GET_AVA_READY_LAUNCH_CTA = "Continue to Home" as const

export const GROWTH_HOME_STARTUP_STEP_PATHS = {
  aiTeammate: `${GROWTH_WORKSPACE_BASE_PATH}/settings/ai-teammate`,
  businessProfile: `${GROWTH_WORKSPACE_BASE_PATH}?setup=profile`,
  findLeads: `${GROWTH_WORKSPACE_BASE_PATH}?setup=find-leads`,
  mailboxOnboard: `${GROWTH_WORKSPACE_BASE_PATH}/settings/communications/connected-mailboxes/onboard`,
  mailboxes: `${GROWTH_WORKSPACE_BASE_PATH}/settings/communications/connected-mailboxes`,
  autonomy: `${GROWTH_WORKSPACE_BASE_PATH}/settings/autonomy`,
  calendar: `${GROWTH_WORKSPACE_BASE_PATH}/settings/calendar`,
  booking: `${GROWTH_WORKSPACE_BASE_PATH}/settings/booking`,
  approvals: `${GROWTH_WORKSPACE_BASE_PATH}/review?tab=packages`,
  prospectSearch: `${GROWTH_WORKSPACE_BASE_PATH}/leads/prospect-search`,
} as const

export const GROWTH_HOME_STARTUP_API_PATHS = {
  aiTeammate: "/api/growth/workspace/settings/ai-teammate",
  autonomy: "/api/growth/workspace/settings/autonomy",
  operatorSetupHealth: "/api/platform/growth/operator-setup-health",
  avaActivate: "/api/growth/workspace/ava/activate",
} as const

const STARTUP_GUARDED_OUTBOUND_CAPABILITIES: GrowthAutonomyCapability[] = [
  "email_outbound",
  "linkedin_outbound",
  "sms_outbound",
]

export function areStartupAutonomyGuardrailsConfigured(input: {
  approvalPolicies: Partial<Record<GrowthAutonomyCapability, GrowthAutonomyApprovalPolicy>>
}): boolean {
  for (const capability of STARTUP_GUARDED_OUTBOUND_CAPABILITIES) {
    const policy = input.approvalPolicies[capability] ?? "always_require_approval"
    if (policy === "fully_autonomous") return false
  }
  return true
}

export function computeStartupProgressPercent(input: {
  completedSteps: number
  totalSteps: number
}): number {
  if (input.totalSteps <= 0) return 0
  return Math.min(100, Math.round((input.completedSteps / input.totalSteps) * 100))
}

export function shouldPromoteGetAvaReadyAboveFold(input: { setupComplete: boolean; showCard: boolean }): boolean {
  return input.showCard && !input.setupComplete
}
