import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { applyDiscountToMrrCents, resolveListMrrCents } from "@/lib/billing/discount-pricing"
import { isPlatformAdminEmail } from "@/lib/platform-admin"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

  let body: {
    discount_type?: string | null
    discount_value?: number | null
    discount_reason?: string | null
    discount_expires_at?: string | null
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid_body", message: "Invalid JSON." }, { status: 400 })
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_config", message: "Server is not configured." }, { status: 503 })
  }

  const { data: sub, error: selErr } = await admin
    .from("organization_subscriptions")
    .select("plan_id, billing_cycle, discount_type, discount_value, discount_expires_at")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (selErr) {
    return NextResponse.json({ error: "query_failed", message: selErr.message }, { status: 500 })
  }
  if (!sub) {
    return NextResponse.json(
      { error: "no_subscription", message: "No subscription row for this organization." },
      { status: 400 },
    )
  }

  const billing_cycle =
    sub.billing_cycle === "annual" || sub.billing_cycle === "monthly" ? sub.billing_cycle : "monthly"
  const baseCents = resolveListMrrCents(sub.plan_id, billing_cycle)

  const rawType = body.discount_type
  const typeNorm =
    rawType == null || String(rawType).trim() === "" ? null : String(rawType).trim().toLowerCase()

  const now = new Date().toISOString()

  // TODO: When Stripe coupons are integrated, sync discount fields to a Stripe coupon / customer balance here.

  if (typeNorm == null || typeNorm === "none") {
    const { error: updErr } = await admin
      .from("organization_subscriptions")
      .update({
        discount_type: null,
        discount_value: null,
        discount_reason: null,
        discount_expires_at: null,
        updated_at: now,
      })
      .eq("organization_id", organizationId)

    if (updErr) {
      return NextResponse.json({ error: "update_failed", message: updErr.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  }

  if (typeNorm !== "percent" && typeNorm !== "fixed") {
    return NextResponse.json(
      { error: "invalid_discount_type", message: "discount_type must be percent, fixed, or empty." },
      { status: 400 },
    )
  }

  const num =
    body.discount_value == null
      ? NaN
      : typeof body.discount_value === "number"
        ? body.discount_value
        : parseFloat(String(body.discount_value))

  if (!Number.isFinite(num)) {
    return NextResponse.json({ error: "invalid_value", message: "discount_value must be a number." }, { status: 400 })
  }

  if (typeNorm === "percent") {
    if (num < 1 || num > 100) {
      return NextResponse.json(
        { error: "invalid_percent", message: "Percent discount must be between 1 and 100." },
        { status: 400 },
      )
    }
  } else {
    if (num <= 0) {
      return NextResponse.json(
        { error: "invalid_fixed", message: "Fixed discount must be greater than 0 (cents)." },
        { status: 400 },
      )
    }
    if (num > baseCents) {
      return NextResponse.json(
        { error: "price_below_zero", message: "Fixed discount cannot exceed list price." },
        { status: 400 },
      )
    }
  }

  let discount_expires_at: string | null = null
  if (body.discount_expires_at != null && String(body.discount_expires_at).trim() !== "") {
    const d = new Date(String(body.discount_expires_at))
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "invalid_expiry", message: "discount_expires_at is not a valid date." }, { status: 400 })
    }
    discount_expires_at = d.toISOString()
  }

  const reason =
    body.discount_reason == null || String(body.discount_reason).trim() === ""
      ? null
      : String(body.discount_reason).trim().slice(0, 2000)

  const { finalCents } = applyDiscountToMrrCents(baseCents, typeNorm, num, discount_expires_at)
  if (finalCents < 0) {
    return NextResponse.json(
      { error: "price_below_zero", message: "Discount would reduce price below $0." },
      { status: 400 },
    )
  }

  const { error: updErr } = await admin
    .from("organization_subscriptions")
    .update({
      discount_type: typeNorm,
      discount_value: num,
      discount_reason: reason,
      discount_expires_at,
      updated_at: now,
    })
    .eq("organization_id", organizationId)

  if (updErr) {
    return NextResponse.json({ error: "update_failed", message: updErr.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
