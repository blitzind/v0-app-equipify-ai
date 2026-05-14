"use server"

import type { SupabaseClient } from "@supabase/supabase-js"
import { equipmentSaveServerDebug } from "@/lib/billing/equipment-save-server-debug"
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

function isNextRedirectError(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false
  const d = (e as { digest?: unknown }).digest
  return typeof d === "string" && d.startsWith("NEXT_REDIRECT")
}

function sanitizeEnforcementError(e: unknown): string {
  if (e instanceof Error) return e.message.slice(0, 280)
  return String(e).slice(0, 280)
}

function isGuardResult(x: SupabaseClient | GuardResult): x is GuardResult {
  return typeof x === "object" && x !== null && "ok" in x && typeof (x as GuardResult).ok === "boolean"
}

function logEnforcementActionFailure(phase: string, organizationId: string, e: unknown): void {
  equipmentSaveServerDebug(phase, {
    helper: "enforceCanCreateRecord",
    organizationId,
    message: sanitizeEnforcementError(e),
  })
}

async function createServerSupabaseClientSafe(organizationId: string): Promise<SupabaseClient | GuardResult> {
  equipmentSaveServerDebug("enforce_ccr_stage", {
    helper: "enforceCanCreateRecord",
    organizationId,
    message: "before_createServerSupabaseClient",
  })
  try {
    const supabase = await createServerSupabaseClient()
    equipmentSaveServerDebug("enforce_ccr_stage", {
      helper: "enforceCanCreateRecord",
      organizationId,
      message: "after_createServerSupabaseClient",
    })
    return supabase
  } catch (e) {
    if (isNextRedirectError(e)) throw e
    equipmentSaveServerDebug("enforce_ccr_stage", {
      helper: "enforceCanCreateRecord",
      organizationId,
      message: `createServerSupabaseClient_threw:${sanitizeEnforcementError(e)}`,
    })
    logEnforcementActionFailure("enforceCanCreateRecord_supabase_client", organizationId, e)
    return {
      ok: false,
      code: "membership_error",
      message: "Could not connect to the workspace session. Refresh the page and try again.",
      httpStatus: 500,
    }
  }
}

async function authGetUserIdSafe(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<string | GuardResult> {
  equipmentSaveServerDebug("enforce_ccr_stage", {
    helper: "enforceCanCreateRecord",
    organizationId,
    message: "before_auth_getUser",
  })
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      equipmentSaveServerDebug("enforce_ccr_stage", {
        helper: "enforceCanCreateRecord",
        organizationId,
        message: `auth_getUser_error:${error.message.slice(0, 160)}`,
      })
      return {
        ok: false,
        code: "unauthorized",
        message: "Session could not be verified. Refresh the page and try again.",
        httpStatus: 401,
      }
    }
    if (!data.user) {
      return { ok: false, code: "unauthorized", message: "Sign in required.", httpStatus: 401 }
    }
    equipmentSaveServerDebug("enforce_ccr_stage", {
      helper: "enforceCanCreateRecord",
      organizationId,
      message: "after_auth_getUser",
    })
    return data.user.id
  } catch (e) {
    if (isNextRedirectError(e)) throw e
    equipmentSaveServerDebug("enforce_ccr_stage", {
      helper: "enforceCanCreateRecord",
      organizationId,
      message: `auth_getUser_threw:${sanitizeEnforcementError(e)}`,
    })
    logEnforcementActionFailure("enforceCanCreateRecord_auth_getUser", organizationId, e)
    return {
      ok: false,
      code: "unauthorized",
      message: "Session could not be verified. Refresh the page and try again.",
      httpStatus: 401,
    }
  }
}

/** Server-verified gate for browser/client inserts (membership + billing + limits). */
export async function enforceCanCreateRecord(
  organizationId: string,
  recordType: CreateRecordType,
): Promise<CreateEnforcementResult> {
  try {
    const supOrErr = await createServerSupabaseClientSafe(organizationId)
    if (isGuardResult(supOrErr)) return supOrErr

    const userOrErr = await authGetUserIdSafe(supOrErr, organizationId)
    if (typeof userOrErr !== "string") return userOrErr

    equipmentSaveServerDebug("enforce_can_create_record_enter", {
      helper: "enforceCanCreateRecord",
      organizationId,
      message: `recordType=${recordType}`,
    })

    equipmentSaveServerDebug("enforce_ccr_stage", {
      helper: "enforceCanCreateRecord",
      organizationId,
      message: "before_requireCanCreateRecord",
    })
    let gate: GuardResult
    try {
      gate = await requireCanCreateRecord(supOrErr, userOrErr, organizationId, recordType)
    } catch (e) {
      if (isNextRedirectError(e)) throw e
      equipmentSaveServerDebug("enforce_ccr_stage", {
        helper: "enforceCanCreateRecord",
        organizationId,
        message: `requireCanCreateRecord_threw:${sanitizeEnforcementError(e)}`,
      })
      logEnforcementActionFailure("enforceCanCreateRecord_require_inner", organizationId, e)
      return {
        ok: false,
        code: "membership_error",
        message: "Could not verify create permission. Try again or contact support.",
        httpStatus: 500,
      }
    }
    equipmentSaveServerDebug("enforce_ccr_stage", {
      helper: "enforceCanCreateRecord",
      organizationId,
      message: `after_requireCanCreateRecord_ok=${gate.ok}`,
    })
    return gate
  } catch (e) {
    if (isNextRedirectError(e)) throw e
    logEnforcementActionFailure("enforceCanCreateRecord_fatal", organizationId, e)
    equipmentSaveServerDebug("enforce_ccr_stage", {
      helper: "enforceCanCreateRecord",
      organizationId,
      message: `fatal_outer:${sanitizeEnforcementError(e)}`,
    })
    return {
      ok: false,
      code: "membership_error",
      message: "Could not verify create permission. Try again or contact support.",
      httpStatus: 500,
    }
  }
}

export async function enforceFeatureAccess(organizationId: string, feature: Feature): Promise<CreateEnforcementResult> {
  try {
    const supOrErr = await createServerSupabaseClientSafe(organizationId)
    if (isGuardResult(supOrErr)) return supOrErr

    const userOrErr = await authGetUserIdSafe(supOrErr, organizationId)
    if (typeof userOrErr !== "string") return userOrErr

    equipmentSaveServerDebug("enforce_ccr_stage", {
      helper: "enforceFeatureAccess",
      organizationId,
      message: "before_org_member_lookup",
    })
    let memberOk = false
    try {
      const member = await supOrErr
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", organizationId)
        .eq("user_id", userOrErr)
        .eq("status", "active")
        .maybeSingle()
      memberOk = Boolean(member.data)
    } catch (e) {
      equipmentSaveServerDebug("enforce_ccr_stage", {
        helper: "enforceFeatureAccess",
        organizationId,
        message: `org_member_lookup_threw:${sanitizeEnforcementError(e)}`,
      })
      memberOk = false
    }

    if (!memberOk) {
      let support = false
      try {
        support = await hasActiveOrganizationSupportSession(supOrErr, userOrErr, organizationId)
      } catch {
        support = false
      }
      if (!support) {
        return { ok: false, code: "forbidden", message: "You do not have access to this organization.", httpStatus: 403 }
      }
    }

    equipmentSaveServerDebug("enforce_ccr_stage", {
      helper: "enforceFeatureAccess",
      organizationId,
      message: "before_requireFeatureAccess",
    })
    try {
      const r = await requireFeatureAccess(supOrErr, organizationId, feature)
      equipmentSaveServerDebug("enforce_ccr_stage", {
        helper: "enforceFeatureAccess",
        organizationId,
        message: `after_requireFeatureAccess_ok=${r.ok}`,
      })
      return r
    } catch (e) {
      if (isNextRedirectError(e)) throw e
      logEnforcementActionFailure("enforceFeatureAccess_require_inner", organizationId, e)
      return {
        ok: false,
        code: "membership_error",
        message: "Could not verify feature access. Try again or contact support.",
        httpStatus: 500,
      }
    }
  } catch (e) {
    if (isNextRedirectError(e)) throw e
    logEnforcementActionFailure("enforceFeatureAccess_fatal", organizationId, e)
    return {
      ok: false,
      code: "membership_error",
      message: "Could not verify feature access. Try again or contact support.",
      httpStatus: 500,
    }
  }
}

export async function enforcePlanLimit(
  organizationId: string,
  limitType: PlanLimitType,
): Promise<CreateEnforcementResult> {
  try {
    const supOrErr = await createServerSupabaseClientSafe(organizationId)
    if (isGuardResult(supOrErr)) return supOrErr

    const userOrErr = await authGetUserIdSafe(supOrErr, organizationId)
    if (typeof userOrErr !== "string") return userOrErr

    equipmentSaveServerDebug("enforce_ccr_stage", {
      helper: "enforcePlanLimit",
      organizationId,
      message: "before_requireCanCreateRecord_customer",
    })
    let denied: GuardResult
    try {
      denied = await requireCanCreateRecord(supOrErr, userOrErr, organizationId, "customer")
    } catch (e) {
      if (isNextRedirectError(e)) throw e
      logEnforcementActionFailure("enforcePlanLimit_require_customer", organizationId, e)
      return {
        ok: false,
        code: "membership_error",
        message: "Could not verify create permission. Try again or contact support.",
        httpStatus: 500,
      }
    }
    if (!denied.ok) return denied

    equipmentSaveServerDebug("enforce_ccr_stage", {
      helper: "enforcePlanLimit",
      organizationId,
      message: "before_requireWithinPlanLimit",
    })
    try {
      const r = await requireWithinPlanLimit(supOrErr, organizationId, limitType, userOrErr)
      equipmentSaveServerDebug("enforce_ccr_stage", {
        helper: "enforcePlanLimit",
        organizationId,
        message: `after_requireWithinPlanLimit_ok=${r.ok}`,
      })
      return r
    } catch (e) {
      if (isNextRedirectError(e)) throw e
      logEnforcementActionFailure("enforcePlanLimit_require_inner", organizationId, e)
      return {
        ok: false,
        code: "usage_unavailable",
        message: "Could not verify plan limits. Try again or contact support.",
        httpStatus: 503,
      }
    }
  } catch (e) {
    if (isNextRedirectError(e)) throw e
    logEnforcementActionFailure("enforcePlanLimit_fatal", organizationId, e)
    return {
      ok: false,
      code: "usage_unavailable",
      message: "Could not verify plan limits. Try again or contact support.",
      httpStatus: 503,
    }
  }
}

export async function enforceMaintenancePlanCreate(organizationId: string): Promise<CreateEnforcementResult> {
  try {
    const supOrErr = await createServerSupabaseClientSafe(organizationId)
    if (isGuardResult(supOrErr)) return supOrErr

    const userOrErr = await authGetUserIdSafe(supOrErr, organizationId)
    if (typeof userOrErr !== "string") return userOrErr

    equipmentSaveServerDebug("enforce_ccr_stage", {
      helper: "enforceMaintenancePlanCreate",
      organizationId,
      message: "before_requireMaintenancePlanCreate",
    })
    try {
      return await requireMaintenancePlanCreate(supOrErr, userOrErr, organizationId)
    } catch (e) {
      if (isNextRedirectError(e)) throw e
      logEnforcementActionFailure("enforceMaintenancePlanCreate_require_inner", organizationId, e)
      return {
        ok: false,
        code: "membership_error",
        message: "Could not verify maintenance plan permission. Try again or contact support.",
        httpStatus: 500,
      }
    }
  } catch (e) {
    if (isNextRedirectError(e)) throw e
    logEnforcementActionFailure("enforceMaintenancePlanCreate_fatal", organizationId, e)
    return {
      ok: false,
      code: "membership_error",
      message: "Could not verify maintenance plan permission. Try again or contact support.",
      httpStatus: 500,
    }
  }
}
