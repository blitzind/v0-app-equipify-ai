import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizePlanIdForRead } from "@/lib/billing/plan-id"
import { computePlatformAdminMrr } from "@/lib/billing/platform-admin-mrr"

type OrgRow = { id: string; status: string | null }
type SubRow = {
  organization_id: string
  plan_id: string | null
  status: string
  trial_ends_at: string | null
  billing_cycle: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  discount_type: string | null
  discount_value: number | string | null
  discount_expires_at: string | null
}

/** Exported for platform admin accounts API KPIs (keep in sync with aggregate analytics). */
export function subscriptionDisplayStatus(
  sub: { status: string; trial_ends_at: string | null } | null,
  orgArchived: boolean,
): "Active" | "Trialing" | "Archived" | "Past Due" | "Canceled" | "Suspended" {
  if (orgArchived) return "Archived"
  if (!sub) return "Trialing"
  const st = sub.status
  if (st === "trialing") {
    if (sub.trial_ends_at && new Date(sub.trial_ends_at).getTime() > Date.now()) return "Trialing"
    return "Canceled"
  }
  if (st === "active") return "Active"
  if (st === "past_due") return "Past Due"
  if (st === "canceled" || st === "unpaid") return "Canceled"
  if (st === "paused") return "Suspended"
  return "Trialing"
}

function planBucketId(planId: string | null | undefined): "solo" | "core" | "growth" | "scale" {
  const p = normalizePlanIdForRead(planId ?? "")
  if (p === "growth") return "growth"
  if (p === "scale") return "scale"
  if (p === "core") return "core"
  return "solo"
}

export type PlatformPlanDistribution = {
  plan: string
  accounts: number
  color: string
}

const PLAN_DIST_META: { id: "solo" | "core" | "growth" | "scale"; plan: string; color: string }[] = [
  { id: "solo", plan: "Solo", color: "#a855f7" },
  { id: "core", plan: "Core", color: "#0ea5e9" },
  { id: "growth", plan: "Growth", color: "#3b82f6" },
  { id: "scale", plan: "Enterprise", color: "#f59f1c" },
]

export type PlatformMetricsComputed = {
  total_accounts: number
  active_accounts: number
  trialing_accounts: number
  archived_accounts: number
  /** Paid subscriptions only (`status === active`), after discounts; annual → monthly equivalent. */
  paid_mrr_cents: number
  /** Estimated MRR if active trials converted; not included in paid_mrr_cents. */
  trial_pipeline_mrr_cents: number
  /**
   * Same as `paid_mrr_cents` — legacy key for charts/snapshots labeled `total_mrr` in DB.
   */
  total_mrr_cents: number
  active_seats: number
  equipment_records: number
  work_orders: number
  plan_distribution: PlatformPlanDistribution[]
}

/**
 * Live platform totals from organizations, subscriptions, members, equipment, and work orders.
 * Paid vs trial MRR matches `computePlatformAdminMrr` in `app/api/platform/accounts/route.ts`.
 */
export async function computePlatformMetrics(admin: SupabaseClient): Promise<PlatformMetricsComputed> {
  const { data: orgs, error: orgErr } = await admin.from("organizations").select("id, status")

  if (orgErr) {
    throw new Error(orgErr.message)
  }

  const list = (orgs ?? []) as OrgRow[]
  const ids = list.map((o) => o.id)

  if (ids.length === 0) {
    return {
      total_accounts: 0,
      active_accounts: 0,
      trialing_accounts: 0,
      archived_accounts: 0,
      paid_mrr_cents: 0,
      trial_pipeline_mrr_cents: 0,
      total_mrr_cents: 0,
      active_seats: 0,
      equipment_records: 0,
      work_orders: 0,
      plan_distribution: PLAN_DIST_META.map((m) => ({ plan: m.plan, accounts: 0, color: m.color })),
    }
  }

  const { data: subs, error: subErr } = await admin
    .from("organization_subscriptions")
    .select(
      "organization_id, plan_id, status, trial_ends_at, billing_cycle, stripe_subscription_id, stripe_price_id, discount_type, discount_value, discount_expires_at",
    )
    .in("organization_id", ids)

  if (subErr) {
    throw new Error(subErr.message)
  }

  const subByOrg = new Map((subs ?? []).map((s) => [(s as SubRow).organization_id, s as SubRow]))

  let archived_accounts = 0
  let active_accounts = 0
  let trialing_accounts = 0
  let paid_mrr_cents = 0
  let trial_pipeline_mrr_cents = 0

  const planCounts: Record<"solo" | "core" | "growth" | "scale", number> = {
    solo: 0,
    core: 0,
    growth: 0,
    scale: 0,
  }

  const nonArchivedIds: string[] = []

  for (const o of list) {
    const orgArchived = o.status === "archived"
    if (orgArchived) {
      archived_accounts += 1
      continue
    }

    nonArchivedIds.push(o.id)

    const sub = subByOrg.get(o.id) ?? null
    const display = subscriptionDisplayStatus(
      sub ? { status: sub.status, trial_ends_at: sub.trial_ends_at } : null,
      false,
    )

    if (display === "Active") active_accounts += 1
    if (display === "Trialing") trialing_accounts += 1

    planCounts[planBucketId(sub?.plan_id)] += 1

    if (!sub) continue

    const parts = computePlatformAdminMrr(sub, false)
    paid_mrr_cents += parts.paidMrrCents
    trial_pipeline_mrr_cents += parts.trialPipelineMrrCents
  }

  let active_seats = 0
  if (nonArchivedIds.length > 0) {
    const { count: seatCt, error: seatErr } = await admin
      .from("organization_members")
      .select("organization_id", { count: "exact", head: true })
      .in("organization_id", nonArchivedIds)
      .eq("status", "active")

    if (seatErr) {
      throw new Error(seatErr.message)
    }
    active_seats = seatCt ?? 0
  }

  let equipment_records = 0
  let work_orders = 0

  if (nonArchivedIds.length > 0) {
    const { count: eqCt, error: eqErr } = await admin
      .from("equipment")
      .select("id", { count: "exact", head: true })
      .in("organization_id", nonArchivedIds)

    if (eqErr) {
      throw new Error(eqErr.message)
    }
    equipment_records = eqCt ?? 0

    const { count: woCt, error: woErr } = await admin
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .in("organization_id", nonArchivedIds)
      .is("archived_at", null)

    if (woErr) {
      throw new Error(woErr.message)
    }
    work_orders = woCt ?? 0
  }

  const plan_distribution: PlatformPlanDistribution[] = PLAN_DIST_META.map((m) => ({
    plan: m.plan,
    accounts: planCounts[m.id],
    color: m.color,
  }))

  return {
    total_accounts: list.length,
    active_accounts,
    trialing_accounts,
    archived_accounts,
    paid_mrr_cents,
    trial_pipeline_mrr_cents,
    total_mrr_cents: paid_mrr_cents,
    active_seats,
    equipment_records,
    work_orders,
    plan_distribution,
  }
}
