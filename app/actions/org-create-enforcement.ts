"use server"

import type { Feature } from "@/lib/billing/entitlements"
import type { CreateRecordType, GuardResult, PlanLimitType } from "@/lib/billing/server-guard"
import {
  requireCanCreateRecord,
  requireFeatureAccess,
  requireMaintenancePlanCreate,
  requireWithinPlanLimit,
} from "@/lib/billing/server-guard"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export type CreateEnforcementResult = GuardResult

/** Server-verified gate for browser/client inserts (membership + billing + limits). */
export async function enforceCanCreateRecord(
  organizationId: string,
  recordType: CreateRecordType,
): Promise<CreateEnforcementResult> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, code: "unauthorized", message: "Sign in required.", httpStatus: 401 }
  }
  return requireCanCreateRecord(supabase, user.id, organizationId, recordType)
}

export async function enforceFeatureAccess(organizationId: string, feature: Feature): Promise<CreateEnforcementResult> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, code: "unauthorized", message: "Sign in required.", httpStatus: 401 }
  }
  const member = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()
  if (!member.data) {
    return { ok: false, code: "forbidden", message: "You do not have access to this organization.", httpStatus: 403 }
  }
  return requireFeatureAccess(supabase, organizationId, feature)
}

export async function enforcePlanLimit(
  organizationId: string,
  limitType: PlanLimitType,
): Promise<CreateEnforcementResult> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, code: "unauthorized", message: "Sign in required.", httpStatus: 401 }
  }
  const denied = await requireCanCreateRecord(supabase, user.id, organizationId, "customer")
  if (!denied.ok) return denied
  return requireWithinPlanLimit(supabase, organizationId, limitType)
}

/** Billing + maintenance_plans feature + membership. */
export async function enforceMaintenancePlanCreate(organizationId: string): Promise<CreateEnforcementResult> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, code: "unauthorized", message: "Sign in required.", httpStatus: 401 }
  }
  return requireMaintenancePlanCreate(supabase, user.id, organizationId)
}
