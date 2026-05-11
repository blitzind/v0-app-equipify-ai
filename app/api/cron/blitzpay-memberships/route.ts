import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { blitzpaySchemaDriftIfUnhealthy } from "@/lib/blitzpay/blitzpay-schema-health"
import { runBlitzpayMembershipsCron } from "@/lib/blitzpay/blitzpay-recurring-billing-engine"

export const runtime = "nodejs"

function authorized(request: Request): boolean {
  const required = process.env.CRON_SECRET?.trim()
  if (!required) return false
  const got = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? ""
  return got.length > 0 && got === required
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 })
  }
  const drift = await blitzpaySchemaDriftIfUnhealthy(admin, "POST /api/cron/blitzpay-memberships")
  if (drift) return drift
  try {
    const result = await runBlitzpayMembershipsCron(admin)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "run_failed", message: msg }, { status: 500 })
  }
}
