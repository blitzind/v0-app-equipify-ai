import type { SupabaseClient } from "@supabase/supabase-js"
import type { PlanId } from "@/lib/plans"
import { getPlanLimits } from "@/lib/billing/entitlements"
import { normalizePlanIdForRead } from "@/lib/billing/plan-id"

export type OrganizationUsage = {
  seatsUsed: number
  equipmentUsed: number
  apiCallsUsedThisMonth: number
}

function utcMonthStartDateString(d = new Date()): string {
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  const day = `${y}-${String(m + 1).padStart(2, "0")}-01`
  return day
}

/** Live counts from Supabase; API usage is 0 until callers increment `organization_api_usage_monthly`. */
export async function getOrganizationUsage(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<OrganizationUsage> {
  const { count: seatsUsed, error: seatsErr } = await supabase
    .from("organization_members")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "active")

  if (seatsErr) throw new Error(seatsErr.message)

  const { count: equipmentUsed, error: eqErr } = await supabase
    .from("equipment")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("is_archived", false)

  if (eqErr) throw new Error(eqErr.message)

  const monthStart = utcMonthStartDateString()
  const { data: usageRow, error: usageErr } = await supabase
    .from("organization_api_usage_monthly")
    .select("api_calls")
    .eq("organization_id", organizationId)
    .eq("month_start", monthStart)
    .maybeSingle()

  if (usageErr) throw new Error(usageErr.message)

  return {
    seatsUsed: seatsUsed ?? 0,
    equipmentUsed: equipmentUsed ?? 0,
    apiCallsUsedThisMonth: typeof usageRow?.api_calls === "number" ? usageRow.api_calls : 0,
  }
}

export type UsageWithLimits = {
  usage: OrganizationUsage
  limits: ReturnType<typeof getPlanLimits>
  percentSeats: number | null
  percentEquipment: number | null
  percentApiCalls: number | null
}

function pct(used: number, max: number | "unlimited" | null): number | null {
  if (max === "unlimited" || max == null) return null
  if (max <= 0) return null
  return Math.min(100, Math.round((used / max) * 1000) / 10)
}

export async function getUsageWithLimits(
  supabase: SupabaseClient,
  organizationId: string,
  planId: PlanId | string,
  isTrialActive?: boolean,
): Promise<UsageWithLimits> {
  const usage = await getOrganizationUsage(supabase, organizationId)
  const limits = getPlanLimits(planId, isTrialActive)

  const userCap = limits.users === "unlimited" ? Number.POSITIVE_INFINITY : limits.users
  const equipCap = limits.equipment === "unlimited" ? Number.POSITIVE_INFINITY : limits.equipment

  const percentSeats =
    userCap === Number.POSITIVE_INFINITY ? null : pct(usage.seatsUsed, userCap)

  const percentEquipment =
    equipCap === Number.POSITIVE_INFINITY ? null : pct(usage.equipmentUsed, equipCap)

  let percentApiCalls: number | null = null
  if (limits.apiCallsMonthly != null && limits.apiCallsMonthly > 0) {
    percentApiCalls = pct(usage.apiCallsUsedThisMonth, limits.apiCallsMonthly)
  }

  return {
    usage,
    limits,
    percentSeats,
    percentEquipment,
    percentApiCalls,
  }
}

/** Normalize plan id from `organization_subscriptions.plan_id` text for limits helpers. */
export function planIdFromSubscriptionRow(rawPlanId: string | null | undefined): PlanId {
  if (!rawPlanId) return "solo"
  return normalizePlanIdForRead(rawPlanId)
}
