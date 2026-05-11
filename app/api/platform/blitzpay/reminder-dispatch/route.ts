import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { runBlitzpayReminderDispatch } from "@/lib/blitzpay/blitzpay-collections"
import { blitzpaySchemaDriftIfUnhealthy } from "@/lib/blitzpay/blitzpay-schema-health"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isPlatformAdminEmail(user.email)) {
    return NextResponse.json({ error: "forbidden", message: "Platform admin access required." }, { status: 403 })
  }
  let body: { dryRun?: boolean }
  try {
    body = (await request.json()) as typeof body
  } catch {
    body = {}
  }
  const dryRun = Boolean(body.dryRun)

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json(
      { error: "server_config", message: "Server is not configured for platform admin operations." },
      { status: 503 },
    )
  }
  const drift = await blitzpaySchemaDriftIfUnhealthy(admin, "POST /api/platform/blitzpay/reminder-dispatch")
  if (drift) return drift

  try {
    const result = await runBlitzpayReminderDispatch(admin, { dryRun, manual: true })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "run_failed", message: msg }, { status: 500 })
  }
}
