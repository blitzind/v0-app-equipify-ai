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
import { hasActiveOrganizationSupportSession } from "@/lib/server/organization-support-session"

export type CreateEnforcementResult = GuardResult

function logEnforcementActionFailure(phase: string, organizationId: string, e: unknown): void {
  if (process.env.NODE_ENV === "production" && process.env.EQUIPMENT_SAVE_SERVER_DEBUG !== "1") return
  const msg = e instanceof Error ? e.message : String(e)
  console.error("[equipify:enforceCanCreateRecord]", phase, {
    organizationIdSuffix: organizationId.length > 8 ? organizationId.slice(-8) : organizationId,
    message: msg.slice(0, 240),
  })
}

/** Server-verified gate for browser/client inserts (membership + billing + limits). */
export async function enforceCanCreateRecord(
  organizationId: string,
  recordType: CreateRecordType,
): Promise<CreateEnforcementResult> {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { ok: false, code: "unauthorized", message: "Sign in required.", httpStatus: 401 }
    }
    return await requireCanCreateRecord(supabase, user.id, organizationId, recordType)
  } catch (e) {
    logEnforcementActionFailure("enforceCanCreateRecord", organizationId, e)
    return {
      ok: false,
      code: "membership_error",
      message: "Could not verify create permission. Try again or contact support.",
      httpStatus: 500,
    }
  }
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
    if (!(await hasActiveOrganizationSupportSession(supabase, user.id, organizationId))) {
      return { ok: false, code: "forbidden", message: "You do not have access to this organization.", httpStatus: 403 }
    }
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
  return requireWithinPlanLimit(supabase, organizationId, limitType, user.id)
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
