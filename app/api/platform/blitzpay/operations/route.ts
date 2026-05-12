import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { fetchBlitzpayPlatformOperationsSummary } from "@/lib/blitzpay/blitzpay-platform-operations"

export const runtime = "nodejs"

export async function GET() {
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
    return NextResponse.json(
      { error: "server_config", message: "Server is not configured for platform admin operations." },
      { status: 503 },
    )
  }
  try {
    const summary = await fetchBlitzpayPlatformOperationsSummary(admin)
    return NextResponse.json({ summary })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[platform blitzpay operations]", msg)
    return NextResponse.json({ error: "load_failed", message: "Could not load BlitzPay operations summary." }, { status: 500 })
  }
}
