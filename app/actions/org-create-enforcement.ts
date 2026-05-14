"use server"

import type { SupabaseClient } from "@supabase/supabase-js"
import { equipmentSaveServerDebug } from "@/lib/billing/equipment-save-server-debug"
import type { Feature } from "@/lib/billing/entitlements"
import type { CreateRecordType, GuardFailureCode, GuardResult, PlanLimitType } from "@/lib/billing/server-guard"
import {
  requireCanCreateRecord,
  requireFeatureAccess,
  requireMaintenancePlanCreate,
  requireWithinPlanLimit,
} from "@/lib/billing/server-guard"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { hasActiveOrganizationSupportSession } from "@/lib/server/organization-support-session"

export type CreateEnforcementResult = GuardResult

const UNABLE_VERIFY_CREATE_MSG = "Unable to verify create permissions right now."

const KNOWN_GUARD_FAILURE_CODES = new Set<string>([
  "unauthorized",
  "forbidden",
  "billing_restricted",
  "billing",
  "equipment",
  "seats",
  "feature_denied",
  "membership_error",
  "usage_unavailable",
  "unexpected_error",
])

function isNextRedirectError(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false
  const d = (e as { digest?: unknown }).digest
  if (typeof d !== "string") return false
  if (d.startsWith("NEXT_REDIRECT")) return true
  const head = d.split(";")[0] ?? ""
  return head === "NEXT_REDIRECT"
}

/** Plain JSON-serializable shape for server action responses (avoids client POST / 500 from bad payloads). */
function sanitizeForClient(result: unknown): CreateEnforcementResult {
  if (!result || typeof result !== "object" || !("ok" in result)) {
    return { ok: false, code: "unexpected_error", message: UNABLE_VERIFY_CREATE_MSG, httpStatus: 500 }
  }
  const r = result as GuardResult
  if (r.ok === true) return { ok: true }
  if (r.ok === false) {
    const rawCode = typeof r.code === "string" ? r.code : ""
    const code: GuardFailureCode = KNOWN_GUARD_FAILURE_CODES.has(rawCode)
      ? (rawCode as GuardFailureCode)
      : "unexpected_error"
    const message =
      typeof r.message === "string" && r.message.trim()
        ? r.message.trim().slice(0, 800)
        : UNABLE_VERIFY_CREATE_MSG
    const hsRaw = r.httpStatus
    const t = typeof hsRaw === "number" && Number.isFinite(hsRaw) ? Math.trunc(hsRaw) : 500
    const httpStatus = t >= 200 && t <= 599 ? t : 500
    return { ok: false, code, message, httpStatus }
  }
  return { ok: false, code: "unexpected_error", message: UNABLE_VERIFY_CREATE_MSG, httpStatus: 500 }
}

async function wrapEnforcementAction(
  actionId: string,
  organizationId: string,
  run: () => Promise<CreateEnforcementResult>,
): Promise<CreateEnforcementResult> {
  equipmentSaveServerDebug(`action_${actionId}_top_enter`, {
    helper: actionId,
    organizationId,
  })
  try {
    const out = await run()
    const okHint =
      out && typeof out === "object" && "ok" in out ? `ok=${String((out as GuardResult).ok)}` : "invalid_shape"
    equipmentSaveServerDebug(`action_${actionId}_top_done`, {
      helper: actionId,
      organizationId,
      message: okHint,
    })
    return sanitizeForClient(out)
  } catch (error) {
    if (isNextRedirectError(error)) throw error
    equipmentSaveServerDebug(`action_${actionId}_top_threw`, {
      helper: actionId,
      organizationId,
      message: sanitizeEnforcementError(error),
    })
    return {
      ok: false,
      code: "unexpected_error",
      message: UNABLE_VERIFY_CREATE_MSG,
      httpStatus: 500,
    }
  }
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
async function enforceCanCreateRecordImpl(
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
      code: "unexpected_error",
      message: UNABLE_VERIFY_CREATE_MSG,
      httpStatus: 500,
    }
  }
}

async function enforceFeatureAccessImpl(organizationId: string, feature: Feature): Promise<CreateEnforcementResult> {
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
      code: "unexpected_error",
      message: UNABLE_VERIFY_CREATE_MSG,
      httpStatus: 500,
    }
  }
}

async function enforcePlanLimitImpl(
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
      code: "unexpected_error",
      message: UNABLE_VERIFY_CREATE_MSG,
      httpStatus: 500,
    }
  }
}

async function enforceMaintenancePlanCreateImpl(organizationId: string): Promise<CreateEnforcementResult> {
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
      code: "unexpected_error",
      message: UNABLE_VERIFY_CREATE_MSG,
      httpStatus: 500,
    }
  }
}

export async function enforceCanCreateRecord(
  organizationId: string,
  recordType: CreateRecordType,
): Promise<CreateEnforcementResult> {
  return wrapEnforcementAction("enforceCanCreateRecord", organizationId, () =>
    enforceCanCreateRecordImpl(organizationId, recordType),
  )
}

export async function enforceFeatureAccess(
  organizationId: string,
  feature: Feature,
): Promise<CreateEnforcementResult> {
  return wrapEnforcementAction("enforceFeatureAccess", organizationId, () =>
    enforceFeatureAccessImpl(organizationId, feature),
  )
}

export async function enforcePlanLimit(
  organizationId: string,
  limitType: PlanLimitType,
): Promise<CreateEnforcementResult> {
  return wrapEnforcementAction("enforcePlanLimit", organizationId, () =>
    enforcePlanLimitImpl(organizationId, limitType),
  )
}

export async function enforceMaintenancePlanCreate(organizationId: string): Promise<CreateEnforcementResult> {
  return wrapEnforcementAction("enforceMaintenancePlanCreate", organizationId, () =>
    enforceMaintenancePlanCreateImpl(organizationId),
  )
}
