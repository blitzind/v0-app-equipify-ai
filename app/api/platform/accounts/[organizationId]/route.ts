import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin"
import { persistOrganizationSubscriptionDiscount } from "@/lib/billing/organization-subscription-discount"
import { normalizeStripeIdColumn } from "@/lib/billing/subscriptions"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BLOCKING_SUB_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "paused", "incomplete"])

/**
 * Internal subscription discount fields (camelCase or snake_case). Stripe is unchanged.
 */
export async function PATCH(
  request: Request,
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

  if (!user?.email || !isPlatformAdminEmail(user.email)) {
    return NextResponse.json({ error: "forbidden", message: "Platform admin access required." }, { status: 403 })
  }

  let json: Record<string, unknown>
  try {
    json = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid_body", message: "Invalid JSON." }, { status: 400 })
  }

  const dtRaw = json.discountType ?? json.discount_type
  const dvRaw = json.discountValue ?? json.discount_value
  const discountLabel = json.discountLabel ?? json.discount_label
  const discountReason = json.discountReason ?? json.discount_reason
  const expRaw = json.discountExpiresAt ?? json.discount_expires_at

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_config", message: "Server is not configured." }, { status: 503 })
  }

  let discount_type: string | null = null
  if (dtRaw != null && String(dtRaw).trim() !== "") {
    const t = String(dtRaw).trim().toLowerCase()
    discount_type = t === "none" ? null : t
  }

  let discount_value: number | null = null
  if (dvRaw != null && typeof dvRaw === "number" && Number.isFinite(dvRaw)) {
    discount_value = dvRaw
  } else if (dvRaw != null && typeof dvRaw === "string" && String(dvRaw).trim() !== "") {
    const n = parseFloat(String(dvRaw))
    discount_value = Number.isFinite(n) ? n : null
  }

  const result = await persistOrganizationSubscriptionDiscount(admin, organizationId, {
    discount_type,
    discount_value,
    discount_label: discountLabel == null ? null : String(discountLabel),
    discount_reason: discountReason == null ? null : String(discountReason),
    discount_expires_at: expRaw == null ? null : String(expRaw),
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.code, message: result.message }, { status: result.status })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
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

  if (!user?.email || !isPlatformAdminEmail(user.email)) {
    return NextResponse.json({ error: "forbidden", message: "Platform admin access required." }, { status: 403 })
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_config", message: "Server is not configured." }, { status: 503 })
  }

  const { data: sub } = await admin
    .from("organization_subscriptions")
    .select("stripe_subscription_id, status")
    .eq("organization_id", organizationId)
    .maybeSingle()

  const stripeSub = normalizeStripeIdColumn(sub?.stripe_subscription_id ?? null)
  const subStatus = typeof sub?.status === "string" ? sub.status : ""
  if (stripeSub && BLOCKING_SUB_STATUSES.has(subStatus)) {
    return NextResponse.json(
      {
        error: "active_subscription",
        message:
          "This organization has an active Stripe subscription. Cancel it in Stripe and wait for sync before deleting.",
      },
      { status: 409 },
    )
  }

  const { count: unpaidCount, error: invErr } = await admin
    .from("org_invoices")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("status", ["overdue", "sent"])

  if (invErr) {
    return NextResponse.json({ error: "invoice_check_failed", message: invErr.message }, { status: 500 })
  }

  if ((unpaidCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error: "unpaid_invoices",
        message: "Cannot delete: this organization has sent or overdue invoices. Resolve billing first.",
      },
      { status: 409 },
    )
  }

  const { error: delErr } = await admin.from("organizations").delete().eq("id", organizationId)

  if (delErr) {
    return NextResponse.json({ error: "delete_failed", message: delErr.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
