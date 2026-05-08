import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchOrganizationPlanId } from "@/lib/ai/plan-gate"
import type { AidenActionType } from "@/lib/aiden/actions/types"
import { getPlan } from "@/lib/plans"
import {
  getEffectiveOrgPermissions,
  normalizeOrgMemberRole,
  type OrgPermissions,
} from "@/lib/permissions/model"

export const AIDEN_ACTIONS_FEATURE_KEY = "aiden_actions" as const

export type { AidenActionType }

export type AidenActionAvailability = {
  enabled: boolean
  featureKey: typeof AIDEN_ACTIONS_FEATURE_KEY
  source: "plan_entitlement" | "manual_enable" | "forced_disable" | "not_entitled"
  planEntitled: boolean
  manuallyEnabled: boolean
  manuallyDisabled: boolean
  reason: string | null
  planId: string
}

const ACTION_PERMISSION_CHECKS: Record<AidenActionType, (permissions: OrgPermissions) => boolean> = {
  create_work_order: (p) => p.canEditWorkOrders || p.canManageDispatch,
  create_customer: (p) => p.canManageProspects || p.canViewAllWorkOrders,
  create_equipment: (p) => p.canEditWorkOrders || p.canViewAllWorkOrders,
  create_maintenance_plan: (p) => p.canManageDispatch,
  create_invoice: (p) => p.canEditInvoices,
  create_quote: (p) => p.canEditQuotes,
  schedule_work_order: (p) => p.canManageDispatch,
  assign_technician: (p) => p.canManageDispatch,
}

export function planIncludesAidenActions(planId: string): boolean {
  return Boolean(getPlan(planId).capabilities?.includes(AIDEN_ACTIONS_FEATURE_KEY))
}

export async function getAidenActionAvailability(args: {
  supabase: SupabaseClient
  organizationId: string
}): Promise<AidenActionAvailability> {
  const planId = await fetchOrganizationPlanId(args.organizationId)
  const planEntitled = planIncludesAidenActions(planId)
  const { data: override } = await args.supabase
    .from("organization_feature_overrides")
    .select("enabled, reason")
    .eq("organization_id", args.organizationId)
    .eq("feature_key", AIDEN_ACTIONS_FEATURE_KEY)
    .maybeSingle()

  const hasOverride = typeof (override as { enabled?: unknown } | null)?.enabled === "boolean"
  const manuallyEnabled = hasOverride && (override as { enabled: boolean }).enabled
  const manuallyDisabled = hasOverride && !(override as { enabled: boolean }).enabled
  const enabled = manuallyEnabled || (planEntitled && !manuallyDisabled)
  const source: AidenActionAvailability["source"] = manuallyEnabled
    ? "manual_enable"
    : manuallyDisabled
      ? "forced_disable"
      : planEntitled
        ? "plan_entitlement"
        : "not_entitled"

  return {
    enabled,
    featureKey: AIDEN_ACTIONS_FEATURE_KEY,
    source,
    planEntitled,
    manuallyEnabled,
    manuallyDisabled,
    reason: (override as { reason?: string | null } | null)?.reason ?? null,
    planId,
  }
}

export async function getAidenActionMembership(args: {
  supabase: SupabaseClient
  organizationId: string
  userId: string
}) {
  const { data: member } = await args.supabase
    .from("organization_members")
    .select("user_id, role, permission_profile, permissions_json")
    .eq("organization_id", args.organizationId)
    .eq("user_id", args.userId)
    .eq("status", "active")
    .maybeSingle()

  if (!member) return null
  return {
    member,
    permissions: getEffectiveOrgPermissions({
      role: normalizeOrgMemberRole((member as { role?: string | null }).role),
      permissionProfile: (member as { permission_profile?: string | null }).permission_profile ?? null,
      permissionsJson: (member as { permissions_json?: unknown }).permissions_json ?? null,
    }),
  }
}

export function canUseAidenActions(availability: AidenActionAvailability): boolean {
  return availability.enabled
}

export function canExecuteAidenAction(args: {
  actionType: AidenActionType
  permissions: OrgPermissions
  availability: AidenActionAvailability
}): { ok: true } | { ok: false; message: string } {
  if (!args.availability.enabled) {
    return { ok: false, message: "AIden Actions is not enabled for this workspace." }
  }
  const check = ACTION_PERMISSION_CHECKS[args.actionType]
  if (!check?.(args.permissions)) {
    return { ok: false, message: "You do not have permission to execute this AIden action." }
  }
  return { ok: true }
}
