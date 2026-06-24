/**
 * GS-RBAC-1A — Client-safe Growth permission helpers.
 */

import {
  growthRoleMeetsMinimum,
  type GrowthRole,
} from "@/lib/growth/rbac/growth-role-types"

export function growthRoleHasMinimum(current: GrowthRole, minimum: GrowthRole): boolean {
  return growthRoleMeetsMinimum(current, minimum)
}

export function isGrowthOperatorRole(role: GrowthRole): boolean {
  return role === "growth_operator"
}

export function isGrowthManagerRole(role: GrowthRole): boolean {
  return role === "growth_manager" || role === "platform_admin"
}

export function isGrowthPlatformAdminRole(role: GrowthRole): boolean {
  return role === "platform_admin"
}

export const GROWTH_OPERATOR_CAPABILITIES = [
  "create_leads",
  "enroll_sequences",
  "manage_inbox",
  "make_calls",
  "update_opportunities",
  "complete_meetings",
  "execute_approved_workflows",
] as const

export const GROWTH_MANAGER_CAPABILITIES = [
  "create_edit_campaigns",
  "manage_automation",
  "manage_audiences",
  "view_team_metrics",
  "manage_outreach_settings",
] as const

export const GROWTH_OPERATOR_DENIALS = [
  "modify_platform_settings",
  "manage_providers",
  "change_compliance_controls",
  "change_autonomy_settings",
  "manage_users",
] as const

export const GROWTH_MANAGER_DENIALS = [
  "manage_platform_infrastructure",
  "manage_billing",
  "change_compliance_policy",
  "change_system_providers",
] as const

export type GrowthOperatorCapability = (typeof GROWTH_OPERATOR_CAPABILITIES)[number]
export type GrowthManagerCapability = (typeof GROWTH_MANAGER_CAPABILITIES)[number]

export function growthRoleCanPerformOperatorAction(role: GrowthRole): boolean {
  return growthRoleMeetsMinimum(role, "growth_operator")
}

export function growthRoleCanPerformManagerAction(role: GrowthRole): boolean {
  return growthRoleMeetsMinimum(role, "growth_manager")
}

export function growthRoleCanPerformPlatformAdminAction(role: GrowthRole): boolean {
  return role === "platform_admin"
}
