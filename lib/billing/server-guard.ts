import type { SupabaseClient } from "@supabase/supabase-js"
import { equipmentSaveServerDebug } from "@/lib/billing/equipment-save-server-debug"
import { describeUnknownThrown, normalizeUnknownServerError } from "@/lib/billing/normalize-unknown-server-error"
import { canUseFeature, type Feature } from "@/lib/billing/entitlements"
import {
  evaluateEquipmentCreate,
  evaluateSeatInvite,
  evaluateStandardCreate,
  type QuotaEvaluationOptions,
  type RecordEligibility,
} from "@/lib/billing/record-eligibility"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import {
  getOrganizationSubscription,
  isTrialActive,
  type OrganizationSubscription,
} from "@/lib/billing/subscriptions"
import { fetchOrganizationSeatMetrics } from "@/lib/billing/seat-counts"
import { getUsageWithLimits, planIdFromSubscriptionRow, type UsageWithLimits } from "@/lib/billing/usage"
import { hasActiveOrganizationSupportSession } from "@/lib/server/organization-support-session"

/** CRM / operational inserts */
export type CreateRecordType =
  | "customer"
  | "equipment"
  | "work_order"
  | "quote"
  | "invoice"
  | "maintenance_plan"
  | "purchase_order"
  | "vendor"
  | "calibration_template"
  | "calibration_record"
  | "org_task"
  | "team_invite"

export type PlanLimitType = "equipment" | "seats"

export type GuardFailureCode =
  | "unauthorized"
  | "forbidden"
  | "billing_restricted"
  | "billing"
  | "equipment"
  | "seats"
  | "feature_denied"
  | "membership_error"
  | "usage_unavailable"
  /** Top-level server action / gate wrapper only — never from plan rules evaluation. */
  | "unexpected_error"

export type GuardResult =
  | { ok: true }
  | { ok: false; code: GuardFailureCode; message: string; httpStatus: number }

function fromEligibility(el: RecordEligibility, httpStatus = 403): GuardResult {
  if (el.ok) return { ok: true }
  if (el.reason === "usage_verify") {
    return { ok: false, code: "usage_unavailable", message: el.message, httpStatus: 503 }
  }
  const code: GuardFailureCode =
    el.reason === "billing"
      ? "billing_restricted"
      : el.reason === "equipment"
        ? "equipment"
        : "seats"
  return { ok: false, code, message: el.message, httpStatus }
}

export async function loadOrgBillingContext(supabase: SupabaseClient, organizationId: string): Promise<{
  subscription: OrganizationSubscription | null
  usagePack: UsageWithLimits | null
  seatSlotsUsed: number | null
  /** True when usage + limits could not be loaded (quota checks may be skipped unless strict). */
  usageLoadFailed: boolean
}> {
  equipmentSaveServerDebug("load_org_billing_context_start", {
    helper: "loadOrgBillingContext",
    organizationId,
  })

  let subscription: OrganizationSubscription | null = null
  try {
    equipmentSaveServerDebug("stage_before_org_subscription_read", {
      helper: "loadOrgBillingContext",
      organizationId,
    })
    subscription = await getOrganizationSubscription(supabase, organizationId)
    equipmentSaveServerDebug("stage_after_org_subscription_read", {
      helper: "loadOrgBillingContext",
      organizationId,
      message: subscription ? "has_row" : "null",
    })
  } catch (e) {
    equipmentSaveServerDebug("stage_org_subscription_read_threw", {
      helper: "loadOrgBillingContext",
      organizationId,
      message: `${e instanceof Error ? e.message : String(e)}|diag=${describeUnknownThrown(e)}`,
    })
    subscription = null
  }

  const planId = planIdFromSubscriptionRow(subscription?.plan_id)
  const trialOn = subscription ? isTrialActive(subscription) : false
  let usagePack: UsageWithLimits | null = null
  let usageLoadFailed = false
  try {
    equipmentSaveServerDebug("stage_before_usage_with_limits", {
      helper: "loadOrgBillingContext",
      organizationId,
      message: `planId=${planId} trialOn=${trialOn}`,
    })
    usagePack = await getUsageWithLimits(supabase, organizationId, planId, trialOn)
    equipmentSaveServerDebug("stage_after_usage_with_limits", {
      helper: "loadOrgBillingContext",
      organizationId,
      message: usagePack ? "ok" : "null",
    })
  } catch (e) {
    equipmentSaveServerDebug("stage_usage_with_limits_threw", {
      helper: "loadOrgBillingContext",
      organizationId,
      message: `${e instanceof Error ? e.message : String(e)}|diag=${describeUnknownThrown(e)}`,
    })
    usagePack = null
    usageLoadFailed = true
  }

  let seatSlotsUsed: number | null = null
  try {
    equipmentSaveServerDebug("stage_before_seat_metrics", {
      helper: "loadOrgBillingContext",
      organizationId,
    })
    const metrics = await fetchOrganizationSeatMetrics(supabase, organizationId)
    seatSlotsUsed = metrics ? metrics.seatsReservedForPlan : null
    equipmentSaveServerDebug("stage_after_seat_metrics", {
      helper: "loadOrgBillingContext",
      organizationId,
      message: seatSlotsUsed == null ? "null" : String(seatSlotsUsed),
    })
  } catch (e) {
    equipmentSaveServerDebug("stage_seat_metrics_threw", {
      helper: "loadOrgBillingContext",
      organizationId,
      message: `${e instanceof Error ? e.message : String(e)}|diag=${describeUnknownThrown(e)}`,
    })
    seatSlotsUsed = null
  }

  equipmentSaveServerDebug("load_org_billing_context_done", {
    helper: "loadOrgBillingContext",
    organizationId,
    message: `sub=${subscription ? "y" : "n"} usage=${usagePack ? "y" : "n"} seats=${seatSlotsUsed ?? "null"}`,
  })

  return { subscription, usagePack, seatSlotsUsed, usageLoadFailed }
}

async function supportSessionOrFalse(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
  reason: string,
): Promise<boolean> {
  try {
    equipmentSaveServerDebug("stage_before_support_session", {
      helper: "verifyActiveMembership",
      organizationId,
      message: reason,
    })
    const ok = await hasActiveOrganizationSupportSession(supabase, userId, organizationId)
    equipmentSaveServerDebug("stage_after_support_session", {
      helper: "verifyActiveMembership",
      organizationId,
      message: `${reason}:${ok ? "true" : "false"}`,
    })
    return ok
  } catch (e) {
    equipmentSaveServerDebug("support_session_threw_in_membership", {
      helper: "verifyActiveMembership",
      organizationId,
      message: `${reason}:${e instanceof Error ? e.message : String(e)}|diag=${describeUnknownThrown(e)}`,
    })
    return false
  }
}

async function verifyActiveMembership(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<GuardResult | null> {
  let data: { user_id: string } | null = null
  let error: { message?: string } | null = null
  try {
    equipmentSaveServerDebug("stage_before_membership_query", {
      helper: "verifyActiveMembership",
      organizationId,
    })
    const res = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle()
    data = (res.data as { user_id: string } | null) ?? null
    error = res.error as { message?: string } | null
    equipmentSaveServerDebug("stage_after_membership_query", {
      helper: "verifyActiveMembership",
      organizationId,
      message: error ? `error:${(error.message ?? "unknown").slice(0, 120)}` : data ? "member" : "no_row",
    })
  } catch (e) {
    equipmentSaveServerDebug("membership_query_throw", {
      helper: "verifyActiveMembership",
      organizationId,
      message: `${e instanceof Error ? e.message : String(e)}|diag=${describeUnknownThrown(e)}`,
    })
    return {
      ok: false,
      code: "membership_error",
      message: "Could not verify workspace membership. Try again in a moment.",
      httpStatus: 503,
    }
  }

  if (error) {
    equipmentSaveServerDebug("membership_query_error", {
      helper: "verifyActiveMembership",
      organizationId,
      message: (error.message ?? String(error)).slice(0, 200),
    })
    if (await supportSessionOrFalse(supabase, userId, organizationId, "on_membership_error")) {
      return null
    }
    return {
      ok: false,
      code: "membership_error",
      message: "Could not verify workspace membership. Try again in a moment.",
      httpStatus: 503,
    }
  }
  if (!data) {
    if (await supportSessionOrFalse(supabase, userId, organizationId, "on_no_member_row")) {
      return null
    }
    return {
      ok: false,
      code: "forbidden",
      message: "You do not have access to this organization.",
      httpStatus: 403,
    }
  }
  return null
}

/**
 * Authenticated user must be an active member of the organization.
 * Use {@link requireCanCreateRecordForOrganization} for cron/service-role where there is no user.
 */
function logCreateGateFailure(
  phase: string,
  e: unknown,
  meta: { organizationId: string; recordType?: CreateRecordType },
): void {
  equipmentSaveServerDebug(phase, {
    helper: "requireCanCreateRecord",
    organizationId: meta.organizationId,
    message: `${e instanceof Error ? e.message : String(e)}|diag=${describeUnknownThrown(e)}`,
  })
}

export async function requireCanCreateRecord(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
  recordType: CreateRecordType,
): Promise<GuardResult> {
  try {
    equipmentSaveServerDebug("create_gate_start", {
      helper: "requireCanCreateRecord",
      organizationId,
      message: `recordType=${recordType}`,
    })

    equipmentSaveServerDebug("require_ccr_stage", {
      helper: "requireCanCreateRecord",
      organizationId,
      message: "before_verifyActiveMembership",
    })
    const denied = await verifyActiveMembership(supabase, userId, organizationId)
    equipmentSaveServerDebug("require_ccr_stage", {
      helper: "requireCanCreateRecord",
      organizationId,
      message: denied ? `verifyMembership_denied:${denied.code}` : "verifyMembership_pass",
    })
    if (denied) return denied
    equipmentSaveServerDebug("require_ccr_stage", {
      helper: "requireCanCreateRecord",
      organizationId,
      message: "after_verifyActiveMembership",
    })

    equipmentSaveServerDebug("require_ccr_stage", {
      helper: "requireCanCreateRecord",
      organizationId,
      message: "before_loadOrgBillingContext",
    })
    const ctx = await loadOrgBillingContext(supabase, organizationId)
    equipmentSaveServerDebug("require_ccr_stage", {
      helper: "requireCanCreateRecord",
      organizationId,
      message: "after_loadOrgBillingContext",
    })

    let actorEmail: string | null | undefined
    try {
      equipmentSaveServerDebug("require_ccr_stage", {
        helper: "requireCanCreateRecord",
        organizationId,
        message: "before_profiles_actor",
      })
      const { data: actorProf } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .maybeSingle()
      actorEmail = (actorProf as { email?: string | null } | null)?.email
      equipmentSaveServerDebug("require_ccr_stage", {
        helper: "requireCanCreateRecord",
        organizationId,
        message: "after_profiles_actor",
      })
    } catch (e) {
      equipmentSaveServerDebug("require_ccr_stage", {
        helper: "requireCanCreateRecord",
        organizationId,
        message: `profiles_actor_threw:${e instanceof Error ? e.message : String(e)}`,
      })
      actorEmail = undefined
    }
    const actorIsPlatformAdmin = isPlatformAdminEmail(actorEmail)

    let usageLoadFailed = ctx.usageLoadFailed
    let supportSession = false
    try {
      equipmentSaveServerDebug("require_ccr_stage", {
        helper: "requireCanCreateRecord",
        organizationId,
        message: "before_support_session",
      })
      supportSession = await hasActiveOrganizationSupportSession(supabase, userId, organizationId)
      equipmentSaveServerDebug("require_ccr_stage", {
        helper: "requireCanCreateRecord",
        organizationId,
        message: "after_support_session",
      })
    } catch (e) {
      equipmentSaveServerDebug("require_ccr_stage", {
        helper: "requireCanCreateRecord",
        organizationId,
        message: `support_session_threw:${e instanceof Error ? e.message : String(e)}`,
      })
      supportSession = false
    }
    if (usageLoadFailed && (recordType === "equipment" || recordType === "team_invite")) {
      if (actorIsPlatformAdmin || supportSession) usageLoadFailed = false
    }

    const skipSeatCap = recordType === "team_invite" && actorIsPlatformAdmin

    equipmentSaveServerDebug("create_gate_apply_rules", {
      helper: "requireCanCreateRecord",
      organizationId,
      message: `recordType=${recordType} usageLoadFailed=${usageLoadFailed}`,
    })

    equipmentSaveServerDebug("require_ccr_stage", {
      helper: "requireCanCreateRecord",
      organizationId,
      message: "before_applyCreateRules",
    })
    const rules = applyCreateRules(ctx.subscription, ctx.usagePack, ctx.seatSlotsUsed, recordType, {
      usageLoadFailed,
      strictUsageCounts: true,
      skipSeatCap,
    })
    equipmentSaveServerDebug("require_ccr_stage", {
      helper: "requireCanCreateRecord",
      organizationId,
      message: `after_applyCreateRules_ok=${rules.ok}`,
    })
    return rules
  } catch (e) {
    logCreateGateFailure("requireCanCreateRecord", e, { organizationId, recordType })
    return normalizeUnknownServerError(e)
  }
}

/**
 * No membership check — for service-role / cron jobs that already scoped `organizationId`.
 */
export async function requireCanCreateRecordForOrganization(
  supabase: SupabaseClient,
  organizationId: string,
  recordType: CreateRecordType,
): Promise<GuardResult> {
  try {
    const ctx = await loadOrgBillingContext(supabase, organizationId)
    return applyCreateRules(ctx.subscription, ctx.usagePack, ctx.seatSlotsUsed, recordType, {
      usageLoadFailed: ctx.usageLoadFailed,
      strictUsageCounts: false,
    })
  } catch (e) {
    logCreateGateFailure("requireCanCreateRecordForOrganization", e, { organizationId, recordType })
    return normalizeUnknownServerError(e)
  }
}

function applyCreateRules(
  subscription: OrganizationSubscription | null,
  usagePack: UsageWithLimits | null,
  seatSlotsUsed: number | null,
  recordType: CreateRecordType,
  quotaOpts?: QuotaEvaluationOptions,
): GuardResult {
  try {
    switch (recordType) {
      case "equipment":
        return fromEligibility(evaluateEquipmentCreate(subscription, usagePack, quotaOpts))
      case "team_invite":
        return fromEligibility(evaluateSeatInvite(subscription, usagePack, seatSlotsUsed, quotaOpts))
      case "customer":
      case "work_order":
      case "quote":
      case "invoice":
      case "maintenance_plan":
      case "purchase_order":
      case "vendor":
      case "calibration_template":
      case "calibration_record":
      case "org_task":
        return fromEligibility(evaluateStandardCreate(subscription))
      default:
        return {
          ok: false,
          code: "forbidden",
          message: "Unsupported record type for create enforcement.",
          httpStatus: 400,
        }
    }
  } catch (e) {
    equipmentSaveServerDebug("apply_create_rules_throw", {
      helper: "applyCreateRules",
      message: `${e instanceof Error ? e.message : String(e)}|diag=${describeUnknownThrown(e)}`,
    })
    return normalizeUnknownServerError(e)
  }
}

/**
 * Entitlements feature gate (plan + trial). Does not check membership.
 */
export async function requireFeatureAccess(
  supabase: SupabaseClient,
  organizationId: string,
  feature: Feature,
): Promise<GuardResult> {
  try {
    const { subscription } = await loadOrgBillingContext(supabase, organizationId)
    const planId = planIdFromSubscriptionRow(subscription?.plan_id)
    const trialOn = subscription ? isTrialActive(subscription) : false
    if (canUseFeature(planId, feature, trialOn)) {
      return { ok: true }
    }
    return {
      ok: false,
      code: "feature_denied",
      message: "This capability is not included in your current plan. Upgrade in billing to continue.",
      httpStatus: 403,
    }
  } catch (e) {
    logCreateGateFailure("requireFeatureAccess", e, { organizationId })
    return normalizeUnknownServerError(e)
  }
}

/**
 * Plan quota only (billing state ignored). Used when invite route already checked billing.
 */
export async function requireWithinPlanLimit(
  supabase: SupabaseClient,
  organizationId: string,
  limitType: PlanLimitType,
  actingUserId?: string | null,
): Promise<GuardResult> {
  try {
    const ctx = await loadOrgBillingContext(supabase, organizationId)
    let usageLoadFailed = ctx.usageLoadFailed
    let skipSeatCap = false
    if (actingUserId) {
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", actingUserId)
          .maybeSingle()
        const em = (prof as { email?: string | null } | null)?.email
        if (isPlatformAdminEmail(em)) {
          usageLoadFailed = false
          skipSeatCap = limitType === "seats"
        }
      } catch {
        /* ignore — treat as non-platform-admin */
      }
    }
    const quotaOpts: QuotaEvaluationOptions = {
      usageLoadFailed,
      strictUsageCounts: true,
      skipSeatCap,
    }
    if (limitType === "equipment") {
      return fromEligibility(evaluateEquipmentCreate(ctx.subscription, ctx.usagePack, quotaOpts))
    }
    return fromEligibility(
      evaluateSeatInvite(ctx.subscription, ctx.usagePack, ctx.seatSlotsUsed, quotaOpts),
    )
  } catch (e) {
    logCreateGateFailure("requireWithinPlanLimit", e, { organizationId })
    return normalizeUnknownServerError(e)
  }
}

/** Combined gate for maintenance plan UI: membership + feature + billing. */
export async function requireMaintenancePlanCreate(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<GuardResult> {
  try {
    const denied = await verifyActiveMembership(supabase, userId, organizationId)
    if (denied) return denied
    const feat = await requireFeatureAccess(supabase, organizationId, "maintenance_plans")
    if (!feat.ok) return feat
    const ctx = await loadOrgBillingContext(supabase, organizationId)
    return applyCreateRules(ctx.subscription, ctx.usagePack, ctx.seatSlotsUsed, "maintenance_plan", {
      usageLoadFailed: ctx.usageLoadFailed,
      strictUsageCounts: true,
    })
  } catch (e) {
    logCreateGateFailure("requireMaintenancePlanCreate", e, { organizationId })
    return normalizeUnknownServerError(e)
  }
}
