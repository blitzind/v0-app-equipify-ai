import type { SupabaseClient } from "@supabase/supabase-js"
import { getBillingAccessState } from "@/lib/billing/access"
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

async function fetchSeatSlots(supabase: SupabaseClient, organizationId: string): Promise<number | null> {
  const metrics = await fetchOrganizationSeatMetrics(supabase, organizationId)
  if (!metrics) return null
  return metrics.seatsReservedForPlan
}

export async function loadOrgBillingContext(supabase: SupabaseClient, organizationId: string): Promise<{
  subscription: OrganizationSubscription | null
  usagePack: UsageWithLimits | null
  seatSlotsUsed: number | null
  /** True when usage + limits could not be loaded (quota checks may be skipped unless strict). */
  usageLoadFailed: boolean
}> {
  let subscription: OrganizationSubscription | null = null
  try {
    subscription = await getOrganizationSubscription(supabase, organizationId)
  } catch {
    subscription = null
  }

  const planId = planIdFromSubscriptionRow(subscription?.plan_id)
  const trialOn = subscription ? isTrialActive(subscription) : false
  let usagePack: UsageWithLimits | null = null
  let usageLoadFailed = false
  try {
    usagePack = await getUsageWithLimits(supabase, organizationId, planId, trialOn)
  } catch {
    usagePack = null
    usageLoadFailed = true
  }

  const seatSlotsUsed = await fetchSeatSlots(supabase, organizationId)
  return { subscription, usagePack, seatSlotsUsed, usageLoadFailed }
}

async function verifyActiveMembership(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<GuardResult | null> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()

  if (error) {
    return { ok: false, code: "membership_error", message: error.message, httpStatus: 403 }
  }
  if (!data) {
    if (await hasActiveOrganizationSupportSession(supabase, userId, organizationId)) {
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
  if (process.env.NODE_ENV === "production" && process.env.EQUIPMENT_SAVE_SERVER_DEBUG !== "1") return
  const msg = e instanceof Error ? e.message : String(e)
  console.error("[equipify:create-gate]", phase, {
    recordType: meta.recordType,
    organizationIdSuffix: meta.organizationId.length > 8 ? meta.organizationId.slice(-8) : meta.organizationId,
    message: msg.slice(0, 240),
  })
}

export async function requireCanCreateRecord(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
  recordType: CreateRecordType,
): Promise<GuardResult> {
  try {
    const denied = await verifyActiveMembership(supabase, userId, organizationId)
    if (denied) return denied

    const ctx = await loadOrgBillingContext(supabase, organizationId)
    const { data: actorProf } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle()
    const actorEmail = (actorProf as { email?: string | null } | null)?.email
    const actorIsPlatformAdmin = isPlatformAdminEmail(actorEmail)

    let usageLoadFailed = ctx.usageLoadFailed
    if (usageLoadFailed && (recordType === "equipment" || recordType === "team_invite")) {
      if (actorIsPlatformAdmin) usageLoadFailed = false
    }

    const skipSeatCap = recordType === "team_invite" && actorIsPlatformAdmin

    return applyCreateRules(ctx.subscription, ctx.usagePack, ctx.seatSlotsUsed, recordType, {
      usageLoadFailed,
      strictUsageCounts: true,
      skipSeatCap,
    })
  } catch (e) {
    logCreateGateFailure("requireCanCreateRecord", e, { organizationId, recordType })
    return {
      ok: false,
      code: "membership_error",
      message: "Could not verify create permission for this workspace. Try again or contact support.",
      httpStatus: 500,
    }
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
    return {
      ok: false,
      code: "membership_error",
      message: "Could not verify create permission for this workspace.",
      httpStatus: 500,
    }
  }
}

function applyCreateRules(
  subscription: OrganizationSubscription | null,
  usagePack: UsageWithLimits | null,
  seatSlotsUsed: number | null,
  recordType: CreateRecordType,
  quotaOpts?: QuotaEvaluationOptions,
): GuardResult {
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
    return {
      ok: false,
      code: "feature_denied",
      message: "Could not verify plan access. Try again or contact support.",
      httpStatus: 500,
    }
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
    return {
      ok: false,
      code: "usage_unavailable",
      message: "Could not verify plan limits. Try again in a moment.",
      httpStatus: 503,
    }
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
    return {
      ok: false,
      code: "membership_error",
      message: "Could not verify maintenance plan permission. Try again or contact support.",
      httpStatus: 500,
    }
  }
}
