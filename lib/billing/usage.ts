import type { SupabaseClient } from "@supabase/supabase-js"
import type { PlanId } from "@/lib/plans"
import { getPlanLimits } from "@/lib/billing/entitlements"
import { normalizePlanIdForRead } from "@/lib/billing/plan-id"

export type OrganizationUsage = {
  /** Active `organization_members` only (not invited / not pending token invites). Billing UI should use `/seat-metrics` for enforcement alignment. */
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

/**
 * Live counts from Supabase.
 * `api_calls` in `organization_api_usage_monthly` is read here; **no application route increments it yet**
 * (Phase 60.2 — see `docs/USAGE_METERING_ENFORCEMENT.md`). Until writers exist, the billing “API calls” bar stays at zero.
 */
export async function getOrganizationUsage(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<OrganizationUsage> {
  let seatsUsed = 0
  const seatsRes = await supabase
    .from("organization_members")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "active")
  if (!seatsRes.error) seatsUsed = seatsRes.count ?? 0

  let equipmentUsed = 0
  const eqRes = await supabase
    .from("equipment")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("archived_at", null)
  if (!eqRes.error) equipmentUsed = eqRes.count ?? 0

  const monthStart = utcMonthStartDateString()
  let apiCallsUsedThisMonth = 0
  const { data: usageRow, error: usageErr } = await supabase
    .from("organization_api_usage_monthly")
    .select("api_calls")
    .eq("organization_id", organizationId)
    .eq("month_start", monthStart)
    .maybeSingle()

  if (!usageErr && usageRow && typeof (usageRow as { api_calls?: unknown }).api_calls === "number") {
    apiCallsUsedThisMonth = (usageRow as { api_calls: number }).api_calls
  }

  return {
    seatsUsed,
    equipmentUsed,
    apiCallsUsedThisMonth,
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

  /** Uses `seatsUsed` (active members only). For plan-cap alignment use `/seat-metrics` + `seatsReservedForPlan`. */
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
export function planIdFromSubscriptionRow(rawPlanId: string | number | null | undefined): PlanId {
  if (rawPlanId == null) return "solo"
  const s = String(rawPlanId).trim()
  if (!s) return "solo"
  return normalizePlanIdForRead(s)
}

/** True when the plan defines a monthly API cap and recorded usage is at or over that cap. */
export function isMonthlyApiCallPlanCapExceeded(pack: UsageWithLimits): boolean {
  const cap = pack.limits.apiCallsMonthly
  if (cap == null || cap <= 0) return false
  return pack.usage.apiCallsUsedThisMonth >= cap
}
