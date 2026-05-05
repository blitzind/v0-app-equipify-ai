import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type SubRow = {
  id: string
  organization_id: string
  stripe_subscription_id: string | null
  status: string | null
  trial_ends_at: string | null
}

/**
 * Decide subscription row status after org reactivation (no Stripe subscription creation).
 */
function resolveSubscriptionStatusAfterReactivate(sub: SubRow): string {
  const hasStripe = Boolean(sub.stripe_subscription_id?.trim())
  const st = (sub.status ?? "").trim().toLowerCase()
  const now = Date.now()
  const trialEndMs = sub.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : NaN
  const trialStillValid = Number.isFinite(trialEndMs) && trialEndMs > now

  if (hasStripe) {
    if (st === "active" || st === "trialing" || st === "past_due" || st === "paused") {
      return st
    }
    if (st === "incomplete") {
      return "trialing"
    }
    if (trialStillValid) return "trialing"
    return "unpaid"
  }

  if (trialStillValid) return "trialing"
  if (st === "active") return "active"
  return "unpaid"
}

async function insertAuditEvent(
  admin: ReturnType<typeof createServiceRoleSupabaseClient>,
  payload: {
    organization_id: string
    admin_user_id: string
    subscription_status_after: string | null
  },
) {
  const { error } = await admin.from("platform_admin_audit_events").insert({
    action: "account_reactivated",
    organization_id: payload.organization_id,
    admin_user_id: payload.admin_user_id,
    metadata: {
      subscription_status_after: payload.subscription_status_after,
      timestamp: new Date().toISOString(),
    },
  })
  if (error) {
    console.warn("[platform reactivate] audit insert skipped:", error.message)
  }
}

/**
 * PATCH — Reactivate an archived organization (workspace access restored).
 * Does not delete or alter tenant CRM data.
 */
export async function PATCH(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization", message: "Invalid organization id." }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id || !user.email || !isPlatformAdminEmail(user.email)) {
    return NextResponse.json({ error: "forbidden", message: "Platform admin access required." }, { status: 403 })
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_config", message: "Server is not configured." }, { status: 503 })
  }

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("id, status")
    .eq("id", organizationId)
    .maybeSingle()

  if (orgErr || !org) {
    return NextResponse.json({ error: "not_found", message: "Organization not found." }, { status: 404 })
  }

  const currentOrgStatus = String((org as { status?: string }).status ?? "").toLowerCase()
  if (currentOrgStatus !== "archived") {
    return NextResponse.json({
      ok: true,
      organization_status: currentOrgStatus || "active",
      already_active: true,
    })
  }

  const { data: sub, error: subErr } = await admin
    .from("organization_subscriptions")
    .select("id, organization_id, stripe_subscription_id, status, trial_ends_at")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (subErr) {
    return NextResponse.json({ error: "query_failed", message: subErr.message }, { status: 500 })
  }

  const nowIso = new Date().toISOString()

  const { error: updOrgErr } = await admin
    .from("organizations")
    .update({ status: "active", updated_at: nowIso })
    .eq("id", organizationId)

  if (updOrgErr) {
    return NextResponse.json({ error: "update_failed", message: updOrgErr.message }, { status: 400 })
  }

  let subscriptionStatusAfter: string | null = null

  if (sub) {
    const row = sub as SubRow
    subscriptionStatusAfter = resolveSubscriptionStatusAfterReactivate(row)
    const { error: updSubErr } = await admin
      .from("organization_subscriptions")
      .update({
        status: subscriptionStatusAfter,
        updated_at: nowIso,
      })
      .eq("organization_id", organizationId)

    if (updSubErr) {
      await admin.from("organizations").update({ status: "archived", updated_at: nowIso }).eq("id", organizationId)
      return NextResponse.json({ error: "subscription_update_failed", message: updSubErr.message }, { status: 400 })
    }
  }

  await insertAuditEvent(admin, {
    organization_id: organizationId,
    admin_user_id: user.id,
    subscription_status_after: subscriptionStatusAfter,
  })

  return NextResponse.json({
    ok: true,
    organization_status: "active",
    subscription_status: subscriptionStatusAfter,
  })
}
