import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { logBlitzpayServerFailure } from "@/lib/blitzpay/blitzpay-server-failure-log"
import { fetchBlitzpayPlatformObservabilityRollup } from "@/lib/blitzpay/blitzpay-platform-observability-rollup"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isPlatformAdminEmail(user.email)) {
    return NextResponse.json({ error: "forbidden", message: "Platform admin access required." }, { status: 403 })
  }

  let windowDays = 30
  try {
    const u = new URL(request.url)
    const raw = u.searchParams.get("windowDays")
    if (raw != null) windowDays = Number(raw)
  } catch {
    /* ignore */
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

  try {
    const rollup = await fetchBlitzpayPlatformObservabilityRollup(admin, { reportingWindowDays: windowDays })
    return NextResponse.json({ rollup })
  } catch (e) {
    logBlitzpayServerFailure("GET /api/platform/blitzpay/observability-rollup", e)
    return NextResponse.json({ error: "load_failed" }, { status: 500 })
  }
}
