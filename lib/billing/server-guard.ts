import type { SupabaseClient } from "@supabase/supabase-js"
import { getBillingAccessState } from "@/lib/billing/access"
import { canUseFeature, type Feature } from "@/lib/billing/entitlements"
import {
  evaluateEquipmentCreate,
  evaluateSeatInvite,
  evaluateStandardCreate,
  type RecordEligibility,
} from "@/lib/billing/record-eligibility"
import {
  getOrganizationSubscription,
  isTrialActive,
  type OrganizationSubscription,
} from "@/lib/billing/subscriptions"
import { getUsageWithLimits, planIdFromSubscriptionRow, type UsageWithLimits } from "@/lib/billing/usage"

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

export type GuardResult =
  | { ok: true }
  | { ok: false; code: GuardFailureCode; message: string; httpStatus: number }

function fromEligibility(el: RecordEligibility, httpStatus = 403): GuardResult {
  if (el.ok) return { ok: true }
  const code: GuardFailureCode =
    el.reason === "billing" ? "billing_restricted" : el.reason === "equipment" ? "equipment" : "seats"
  return { ok: false, code, message: el.message, httpStatus }
}

async function fetchSeatSlots(supabase: SupabaseClient, organizationId: string): Promise<number | null> {
  const { count, error } = await supabase
    .from("organization_members")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("status", ["active", "invited"])

  if (error) return null
  return count ?? 0
}

export async function loadOrgBillingContext(supabase: SupabaseClient, organizationId: string): Promise<{
  subscription: OrganizationSubscription | null
  usagePack: UsageWithLimits | null
  seatSlotsUsed: number | null
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
  try {
    usagePack = await getUsageWithLimits(supabase, organizationId, planId, trialOn)
  } catch {
    usagePack = null
  }

  const seatSlotsUsed = await fetchSeatSlots(supabase, organizationId)
  return { subscription, usagePack, seatSlotsUsed }
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
export async function requireCanCreateRecord(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
  recordType: CreateRecordType,
): Promise<GuardResult> {
  const denied = await verifyActiveMembership(supabase, userId, organizationId)
  if (denied) return denied

  const ctx = await loadOrgBillingContext(supabase, organizationId)
  return applyCreateRules(ctx.subscription, ctx.usagePack, ctx.seatSlotsUsed, recordType)
}

/**
 * No membership check — for service-role / cron jobs that already scoped `organizationId`.
 */
export async function requireCanCreateRecordForOrganization(
  supabase: SupabaseClient,
  organizationId: string,
  recordType: CreateRecordType,
): Promise<GuardResult> {
  const ctx = await loadOrgBillingContext(supabase, organizationId)
  return applyCreateRules(ctx.subscription, ctx.usagePack, ctx.seatSlotsUsed, recordType)
}

function applyCreateRules(
  subscription: OrganizationSubscription | null,
  usagePack: UsageWithLimits | null,
  seatSlotsUsed: number | null,
  recordType: CreateRecordType,
): GuardResult {
  switch (recordType) {
    case "equipment":
      return fromEligibility(evaluateEquipmentCreate(subscription, usagePack))
    case "team_invite":
      return fromEligibility(evaluateSeatInvite(subscription, usagePack, seatSlotsUsed))
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
}

/**
 * Plan quota only (billing state ignored). Used when invite route already checked billing.
 */
export async function requireWithinPlanLimit(
  supabase: SupabaseClient,
  organizationId: string,
  limitType: PlanLimitType,
): Promise<GuardResult> {
  const ctx = await loadOrgBillingContext(supabase, organizationId)
  if (limitType === "equipment") {
    return fromEligibility(evaluateEquipmentCreate(ctx.subscription, ctx.usagePack))
  }
  return fromEligibility(evaluateSeatInvite(ctx.subscription, ctx.usagePack, ctx.seatSlotsUsed))
}

/** Combined gate for maintenance plan UI: membership + feature + billing. */
export async function requireMaintenancePlanCreate(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<GuardResult> {
  const denied = await verifyActiveMembership(supabase, userId, organizationId)
  if (denied) return denied
  const feat = await requireFeatureAccess(supabase, organizationId, "maintenance_plans")
  if (!feat.ok) return feat
  const ctx = await loadOrgBillingContext(supabase, organizationId)
  return applyCreateRules(ctx.subscription, ctx.usagePack, ctx.seatSlotsUsed, "maintenance_plan")
}
