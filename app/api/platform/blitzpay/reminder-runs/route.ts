import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isPlatformAdminEmail(user.email)) {
    return NextResponse.json({ error: "forbidden", message: "Platform admin access required." }, { status: 403 })
  }
  const limit = Math.min(50, Math.max(5, Math.round(Number(new URL(request.url).searchParams.get("limit") ?? "25"))))

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json(
      { error: "server_config", message: "Server is not configured for platform admin operations." },
      { status: 503 },
    )
  }
  const { data, error } = await admin
    .from("blitzpay_reminder_runs")
    .select("id, trigger, status, reminders_evaluated, reminders_sent, reminders_skipped, summary, error, created_at, finished_at")
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) {
    return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 })
  }
  return NextResponse.json({ runs: data ?? [] })
}
