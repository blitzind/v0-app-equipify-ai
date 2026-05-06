import type { SupabaseClient, User } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import {
  createServerSupabaseClient,
  createSupabaseClientWithAccessToken,
  getBearerAccessToken,
} from "@/lib/supabase/server"
import { normalizePlanIdForRead } from "@/lib/billing/plan-id"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { normalizeStripeIdColumn } from "@/lib/billing/subscriptions"
import { seedDemoForIndustry } from "@/lib/demo-seeding/seed-engine"

type Body = {
  organizationId?: string | null
  organizationName?: string | null
  seedDemo?: boolean
  industry?: string | null
  /** Paid plan chosen in onboarding; trial access is always Scale until checkout. */
  selectedPlan?: string | null
  billingCycle?: string | null
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
}

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

/**
 * New self-serve org: one subscription row with Scale trial + intended paid tier for later checkout.
 * Idempotent if a row already exists without a Stripe subscription (e.g. race).
 */
async function bootstrapOnboardingTrialSubscription(
  organizationId: string,
  opts: { intendedPlanKey: string | null | undefined; billingCycle: string | null | undefined },
) {
  const admin = createServiceRoleSupabaseClient()
  const intendedPlan = normalizePlanIdForRead(String(opts.intendedPlanKey ?? "growth"))
  const billingCycle = opts.billingCycle === "annual" ? "annual" : "monthly"
  const now = new Date().toISOString()
  const trialEnd = new Date(Date.now() + FOURTEEN_DAYS_MS).toISOString()

  const payload = {
    plan_id: "scale",
    intended_plan_id: intendedPlan,
    billing_cycle: billingCycle,
    status: "trialing",
    trial_starts_at: now,
    trial_ends_at: trialEnd,
    updated_at: now,
  }

  const { error: insertErr } = await admin.from("organization_subscriptions").insert({
    organization_id: organizationId,
    ...payload,
  })

  if (!insertErr) return

  if (insertErr.code !== "23505") {
    throw new Error(insertErr.message)
  }

  const { data: existing, error: selErr } = await admin
    .from("organization_subscriptions")
    .select("stripe_subscription_id")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (selErr) throw new Error(selErr.message)
  if (normalizeStripeIdColumn(existing?.stripe_subscription_id ?? null)) return

  const { error: updateErr } = await admin
    .from("organization_subscriptions")
    .update(payload)
    .eq("organization_id", organizationId)

  if (updateErr) throw new Error(updateErr.message)
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid request body." }, { status: 400 })
  }

  const bearer = getBearerAccessToken(request)
  const cookieClient = await createServerSupabaseClient()

  let supabase: SupabaseClient = cookieClient
  let user: User | null = null

  if (bearer) {
    const { data, error } = await cookieClient.auth.getUser(bearer)
    if (error || !data.user) {
      return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 })
    }
    user = data.user
    supabase = createSupabaseClientWithAccessToken(bearer)
  } else {
    const {
      data: { user: cookieUser },
    } = await cookieClient.auth.getUser()
    user = cookieUser ?? null
  }

  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 })
  }

  const seedDemo = body.seedDemo !== false
  let organizationId = typeof body.organizationId === "string" ? body.organizationId.trim() : ""
  let createdNewOrganization = false

  if (organizationId) {
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .in("status", ["active", "invited"])
      .maybeSingle()
    if (!membership) {
      return NextResponse.json(
        { error: "forbidden", message: "You do not have access to this organization." },
        { status: 403 },
      )
    }
  } else {
    const { data: memberships } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)

    if (memberships?.[0]?.organization_id) {
      organizationId = memberships[0].organization_id
    } else {
      const baseName =
        (typeof body.organizationName === "string" ? body.organizationName.trim() : "") || "My Organization"
      const baseSlug = slugify(baseName) || `org-${user.id.slice(0, 8)}`
      let created: { id?: string } | null = null
      let lastError = "Unable to create organization."

      for (let i = 0; i < 3; i += 1) {
        const candidateSlug = i === 0 ? baseSlug : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`
        const { data, error } = await supabase.rpc("create_organization_with_owner", {
          org_name: baseName,
          org_slug: candidateSlug,
        })
        if (!error && data && typeof data === "object") {
          created = data as { id?: string }
          break
        }
        lastError = error?.message ?? lastError
      }

      if (!created?.id) {
        return NextResponse.json(
          { error: "organization_create_failed", message: lastError },
          { status: 400 },
        )
      }
      organizationId = created.id
      createdNewOrganization = true
    }
  }

  if (createdNewOrganization) {
    try {
      await bootstrapOnboardingTrialSubscription(organizationId, {
        intendedPlanKey: body.selectedPlan,
        billingCycle: body.billingCycle,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not activate trial subscription."
      return NextResponse.json(
        { error: "trial_bootstrap_failed", message, organizationId },
        { status: 500 },
      )
    }
  }

  let svc
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "service_unavailable", message: "Server configuration error." }, { status: 503 })
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const fn =
    (typeof body.firstName === "string" ? body.firstName.trim() : "") ||
    String(meta.first_name ?? "").trim()
  const ln =
    (typeof body.lastName === "string" ? body.lastName.trim() : "") ||
    String(meta.last_name ?? "").trim()
  const composedFull = [fn, ln].filter(Boolean).join(" ").trim()
  const fullName =
    composedFull ||
    String(meta.full_name ?? "").trim() ||
    (user.email ? user.email.split("@")[0]?.trim() ?? "" : "") ||
    null
  const profileUpsert: Record<string, unknown> = {
    id: user.id,
    email: user.email ?? null,
    full_name: fullName,
    default_organization_id: organizationId,
    updated_at: new Date().toISOString(),
  }
  if (typeof body.phone === "string") {
    profileUpsert.phone = body.phone.trim().slice(0, 64) || null
  }

  const { error: profUpsertErr } = await svc.from("profiles").upsert(profileUpsert, { onConflict: "id" })
  if (profUpsertErr) {
    return NextResponse.json(
      { error: "profile_failed", message: profUpsertErr.message, organizationId },
      { status: 400 },
    )
  }

  await svc.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...meta,
      full_name: fullName ?? meta.full_name,
      first_name: fn || meta.first_name,
      last_name: ln || meta.last_name,
    },
  })

  let seeded = false
  let seedSkipped = false
  let techniciansSeeded = false
  let seededIndustry: string | null = null
  let seedCounts: Record<string, number> | null = null

  if (seedDemo) {
    try {
      const seedResult = await seedDemoForIndustry({
        supabase: svc,
        organizationId,
        ownerUserId: user.id,
        industry: body.industry,
      })
      seededIndustry = seedResult.industry
      seeded = seedResult.seeded
      seedSkipped = seedResult.skipped
      techniciansSeeded = Boolean(seedResult.techniciansSeeded)
      seedCounts = (seedResult.counts ?? null) as Record<string, number> | null
      if (process.env.NODE_ENV === "development") {
        console.info("[onboarding/provision] demo seed", {
          organizationId,
          industry: body.industry,
          seedDemo,
          seeded,
          seedSkipped,
          seededIndustry,
          seedCounts,
          techniciansSeeded,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to seed demo data."
      return NextResponse.json(
        { error: "seed_failed", message, organizationId },
        { status: 400 },
      )
    }
  } else if (process.env.NODE_ENV === "development") {
    console.info("[onboarding/provision] demo seed skipped", { organizationId, seedDemo })
  }

  return NextResponse.json({
    ok: true,
    organizationId,
    seeded,
    seedSkipped,
    seededIndustry,
    seedCounts,
    techniciansSeeded,
  })
}
