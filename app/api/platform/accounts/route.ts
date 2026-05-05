import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin"
import { normalizePlanIdForRead } from "@/lib/billing/plan-id"
import type { AccountStatus, PlatformAccount } from "@/lib/admin-data"

function mapPlanTier(planId: string | null | undefined): PlatformAccount["plan"] {
  const p = normalizePlanIdForRead(planId ?? "")
  if (p === "growth") return "Growth"
  if (p === "scale") return "Enterprise"
  if (p === "core") return "Core"
  return "Starter"
}

function subscriptionDisplayStatus(
  sub: { status: string; trial_ends_at: string | null } | null,
  orgArchived: boolean,
): AccountStatus {
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
    return NextResponse.json({ accounts: [] as PlatformAccount[] })
  }

  const { data: subs } = await admin
    .from("organization_subscriptions")
    .select("organization_id, plan_id, status, trial_ends_at, billing_cycle, stripe_subscription_id")
    .in("organization_id", ids)

  const subByOrg = new Map((subs ?? []).map((s) => [s.organization_id, s]))

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
    const sub = subByOrg.get(o.id) ?? null
    const owner = ownerByOrg.get(o.id) ?? { email: "", name: "" }
    const billingCycle =
      sub?.billing_cycle === "annual" || sub?.billing_cycle === "monthly" ? sub.billing_cycle : "monthly"

    return {
      id: o.id,
      name: o.name,
      slug: String(o.slug ?? ""),
      ownerName: owner.name || "—",
      ownerEmail: owner.email || "—",
      plan: mapPlanTier(sub?.plan_id),
      billingCycle,
      status: subscriptionDisplayStatus(
        sub ? { status: sub.status, trial_ends_at: sub.trial_ends_at } : null,
        orgArchived,
      ),
      organizationArchived: orgArchived,
      mrr: 0,
      seats: seatCount.get(o.id) ?? 0,
      equipmentCount: 0,
      workOrderCount: 0,
      createdAt: o.created_at?.slice(0, 10) ?? "",
      lastActive: (o.updated_at ?? o.created_at)?.slice(0, 10) ?? "",
      trialEndsAt: sub?.trial_ends_at?.slice(0, 10) || undefined,
      country: "",
      industry: "",
    }
  })

  return NextResponse.json({ accounts })
}
