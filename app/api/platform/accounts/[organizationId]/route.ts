import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin"
import { normalizeStripeIdColumn } from "@/lib/billing/subscriptions"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BLOCKING_SUB_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "paused", "incomplete"])

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
