import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Body = {
  action?: "acknowledge" | "resolve"
}

export async function PATCH(request: Request, context: { params: Promise<{ alertId: string }> }) {
  const { alertId } = await context.params
  if (!UUID_RE.test(alertId)) {
    return NextResponse.json({ error: "invalid_alert", message: "Invalid alert id." }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email || !isPlatformAdminEmail(user.email)) {
    return NextResponse.json({ error: "forbidden", message: "Platform admin access required." }, { status: 403 })
  }

  let body: Body = {}
  try {
    body = (await request.json()) as Body
  } catch {
    body = {}
  }

  const action = body.action
  if (action !== "acknowledge" && action !== "resolve") {
    return NextResponse.json({ error: "invalid_action", message: "action must be acknowledge or resolve." }, { status: 400 })
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_config", message: "Server is not configured." }, { status: 503 })
  }

  const now = new Date().toISOString()
  const patch =
    action === "acknowledge"
      ? { status: "acknowledged", acknowledged_at: now, acknowledged_by: user.id, updated_at: now }
      : { status: "resolved", resolved_at: now, resolved_by: user.id, updated_at: now }

  const { error } = await admin.from("ai_alerts").update(patch).eq("id", alertId)
  if (error) {
    return NextResponse.json({ error: "update_failed", message: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, status: patch.status })
}

