import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { normalizePlanIdForRead } from "@/lib/billing/plan-id"
import { isPlatformAdminEmail } from "@/lib/platform-admin"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ALLOWED_PLANS = new Set(["solo", "core", "growth", "scale"])
const ALLOWED_CYCLES = new Set(["monthly", "annual"])
const ALLOWED_STATUS = new Set(["trialing", "active", "past_due", "canceled"])

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
    plan_id?: string
    billing_cycle?: string
    status?: string
    trial_ends_at?: string | null
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid_body", message: "Invalid JSON." }, { status: 400 })
  }

  const plan_id = normalizePlanIdForRead(String(body.plan_id ?? ""))
  if (!ALLOWED_PLANS.has(plan_id)) {
    return NextResponse.json({ error: "invalid_plan", message: "plan_id must be solo, core, growth, or scale." }, { status: 400 })
  }

  const billing_cycle = String(body.billing_cycle ?? "").trim().toLowerCase()
  if (!ALLOWED_CYCLES.has(billing_cycle)) {
    return NextResponse.json({ error: "invalid_cycle", message: "billing_cycle must be monthly or annual." }, { status: 400 })
  }

  const status = String(body.status ?? "").trim().toLowerCase()
  if (!ALLOWED_STATUS.has(status)) {
    return NextResponse.json(
      { error: "invalid_status", message: "status must be trialing, active, past_due, or canceled." },
      { status: 400 },
    )
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_config", message: "Server is not configured." }, { status: 503 })
  }

  const { data: existing, error: selErr } = await admin
    .from("organization_subscriptions")
    .select("id")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (selErr) {
    return NextResponse.json({ error: "query_failed", message: selErr.message }, { status: 500 })
  }

  const now = new Date().toISOString()

  const patch: Record<string, unknown> = {
    plan_id,
    billing_cycle,
    status,
    updated_at: now,
  }

  if (status === "active") {
    patch.intended_plan_id = null
  }

  if (status === "trialing") {
    const raw = body.trial_ends_at
    if (raw != null && String(raw).trim() !== "") {
      const d = new Date(String(raw))
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "invalid_trial_end", message: "trial_ends_at is not a valid date." }, { status: 400 })
      }
      patch.trial_ends_at = d.toISOString()
    } else if (!existing) {
      return NextResponse.json(
        { error: "trial_required", message: "trial_ends_at is required when creating a trialing subscription." },
        { status: 400 },
      )
    }
  } else {
    patch.trial_ends_at = null
  }

  if (!existing) {
    const { error: insErr } = await admin.from("organization_subscriptions").insert({
      organization_id: organizationId,
      ...patch,
      trial_starts_at: status === "trialing" ? now : null,
      intended_plan_id: null,
    })

    if (insErr) {
      return NextResponse.json({ error: "insert_failed", message: insErr.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  }

  const { error: updErr } = await admin
    .from("organization_subscriptions")
    .update(patch)
    .eq("organization_id", organizationId)

  if (updErr) {
    return NextResponse.json({ error: "update_failed", message: updErr.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
