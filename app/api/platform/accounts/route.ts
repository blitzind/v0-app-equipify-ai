import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin"
import { trialDaysLeftFromIso } from "@/lib/billing/trial-days-left"
import { computePlatformAdminMrr } from "@/lib/billing/platform-admin-mrr"
import type { AccountDisplayStatus, PlatformAccount } from "@/lib/admin-data"

function normalizeOrgKey(id: string): string {
  return String(id).trim().toLowerCase()
}

/** Display label from `organization_subscriptions.plan_id` (DB is source of truth). */
function mapPlanIdToDisplay(planId: string | null | undefined): string {
  if (planId == null || String(planId).trim() === "") return "—"
  const p = String(planId).trim().toLowerCase()
  switch (p) {
    case "starter":
    case "solo":
      return "Starter"
    case "core":
      return "Core"
    case "growth":
      return "Growth"
    case "scale":
      return "Scale"
    case "enterprise":
      return "Enterprise"
    default:
      return String(planId).trim()
  }
}

/** Display pill from org archive flag + raw `organization_subscriptions.status`. */
function mapSubscriptionStatusToDisplay(
  orgArchived: boolean,
  raw: string | null | undefined,
): AccountDisplayStatus {
  if (orgArchived) return "Archived"
  if (raw == null || String(raw).trim() === "") return "—"
  const st = String(raw).trim().toLowerCase()
  switch (st) {
    case "trialing":
      return "Trialing"
    case "active":
      return "Active"
    case "past_due":
      return "Past Due"
    case "canceled":
    case "unpaid":
      return "Canceled"
    case "paused":
      return "Suspended"
    case "incomplete":
      return "Trialing"
    case "incomplete_expired":
      return "Canceled"
    default:
      return "—"
  }
}

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email || !isPlatformAdminEmail(user.email)) {
    return NextResponse.json({ error: "forbidden", message: "Platform admin access required." }, { status: 403 })
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json(
      { error: "server_config", message: "Server is not configured for platform admin operations." },
      { status: 503 },
    )
  }

  const { data: orgs, error: orgErr } = await admin
    .from("organizations")
    .select("id, name, slug, status, created_at, updated_at")
    .order("created_at", { ascending: false })

  if (orgErr) {
    return NextResponse.json({ error: "query_failed", message: orgErr.message }, { status: 500 })
  }

  const list = orgs ?? []
  const ids = list.map((o) => o.id)
  if (ids.length === 0) {
    return NextResponse.json({ accounts: [] as PlatformAccount[], totalMrrCents: 0 })
  }

  const { data: subs, error: subsErr } = await admin
    .from("organization_subscriptions")
    .select(
      "organization_id, plan_id, intended_plan_id, status, trial_ends_at, billing_cycle, stripe_subscription_id, stripe_price_id, discount_type, discount_value, discount_label, discount_reason, discount_expires_at, created_at",
    )
    .in("organization_id", ids)
    .order("created_at", { ascending: false })

  if (subsErr) {
    return NextResponse.json({ error: "query_failed", message: subsErr.message }, { status: 500 })
  }

  /** Latest row per org when multiple rows exist (should be unique per org). */
  const subByOrg = new Map<string, (typeof subs)[number]>()
  for (const s of subs ?? []) {
    const k = normalizeOrgKey(s.organization_id)
    if (!subByOrg.has(k)) subByOrg.set(k, s)
  }

  const { data: ownerRows } = await admin
    .from("organization_members")
    .select("organization_id, profiles(email, full_name)")
    .eq("role", "owner")
    .eq("status", "active")
    .in("organization_id", ids)

  const ownerByOrg = new Map<string, { email: string; name: string }>()
  for (const row of ownerRows ?? []) {
    if (ownerByOrg.has(row.organization_id)) continue
    const prof = row.profiles as { email?: string | null; full_name?: string | null } | null
    ownerByOrg.set(row.organization_id, {
      email: typeof prof?.email === "string" ? prof.email : "",
      name: typeof prof?.full_name === "string" ? prof.full_name : "",
    })
  }

  const { data: seatRows } = await admin
    .from("organization_members")
    .select("organization_id")
    .in("organization_id", ids)
    .eq("status", "active")

  const seatCount = new Map<string, number>()
  for (const r of seatRows ?? []) {
    seatCount.set(r.organization_id, (seatCount.get(r.organization_id) ?? 0) + 1)
  }

  const accounts: PlatformAccount[] = list.map((o) => {
    const orgArchived = o.status === "archived"
    const sub = subByOrg.get(normalizeOrgKey(o.id)) ?? null
    const owner = ownerByOrg.get(o.id) ?? { email: "", name: "" }

    const billingCycle =
      sub?.billing_cycle === "annual" || sub?.billing_cycle === "monthly" ? sub.billing_cycle : null

    const trialEndsAtIso = sub?.trial_ends_at ?? null
    const trialDaysLeft = trialDaysLeftFromIso(trialEndsAtIso)

    const mrrParts = computePlatformAdminMrr(sub, orgArchived)
    const showRowMrr = mrrParts.showMrrInTable
    const mrrCents = showRowMrr ? mrrParts.finalCents : 0
    const mrrBaseCents = showRowMrr ? mrrParts.mrrBaseCents : null
    const hasActiveDiscount = showRowMrr && mrrParts.hasActiveDiscount

    const subscriptionStatus = sub?.status ?? null

    const displayPlan = orgArchived && !sub ? "—" : mapPlanIdToDisplay(sub?.plan_id ?? null)
    const displayStatus = mapSubscriptionStatusToDisplay(orgArchived, sub?.status ?? null)

    return {
      id: o.id,
      name: o.name,
      slug: String(o.slug ?? ""),
      ownerName: owner.name || "—",
      ownerEmail: owner.email || "—",
      plan: displayPlan,
      displayPlan,
      billingCycle,
      status: displayStatus,
      displayStatus,
      organizationArchived: orgArchived,
      mrr: mrrCents,
      mrrBaseCents,
      hasActiveDiscount,
      discountType: sub?.discount_type ?? null,
      discountValue:
        sub?.discount_value != null && sub.discount_value !== ""
          ? Number(sub.discount_value)
          : null,
      discountLabel: sub?.discount_label ?? null,
      discountReason: sub?.discount_reason ?? null,
      discountExpiresAt: sub?.discount_expires_at ?? null,
      seats: seatCount.get(o.id) ?? 0,
      equipmentCount: 0,
      workOrderCount: 0,
      createdAt: o.created_at?.slice(0, 10) ?? "",
      lastActive: (o.updated_at ?? o.created_at)?.slice(0, 10) ?? "",
      trialEndsAt: trialEndsAtIso,
      trial_ends_at: trialEndsAtIso,
      trialDaysLeft,
      subscriptionStatus,
      billingStatus: subscriptionStatus,
      planId: sub?.plan_id ?? null,
      intendedPlanId: sub?.intended_plan_id ?? null,
      stripeSubscriptionId: sub?.stripe_subscription_id ?? null,
      stripePriceId: sub?.stripe_price_id ?? null,
      country: "",
      industry: "",
    }
  })

  let totalMrrCents = 0
  for (const o of list) {
    const orgArchived = o.status === "archived"
    const sub = subByOrg.get(normalizeOrgKey(o.id)) ?? null
    const parts = computePlatformAdminMrr(sub, orgArchived)
    if (parts.countsTowardPlatformTotal) {
      totalMrrCents += parts.finalCents
    }
  }

  return NextResponse.json({ accounts, totalMrrCents })
}
