import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin"
import { computePlatformMetrics } from "@/lib/platform-analytics-compute"

// TODO: schedule a daily cron (e.g. Vercel cron / Supabase pg_cron) to POST this snapshot once per day in UTC.

export async function POST() {
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

  let metrics
  try {
    metrics = await computePlatformMetrics(admin)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed to compute metrics"
    return NextResponse.json({ error: "compute_failed", message: msg }, { status: 500 })
  }

  const metric_date = new Date().toISOString().slice(0, 10)

  const { error: upErr } = await admin.from("platform_metrics_daily").upsert(
    {
      metric_date,
      total_accounts: metrics.total_accounts,
      active_accounts: metrics.active_accounts,
      trialing_accounts: metrics.trialing_accounts,
      archived_accounts: metrics.archived_accounts,
      total_mrr: metrics.total_mrr_cents,
      trial_pipeline_mrr: metrics.trial_pipeline_mrr_cents,
      active_seats: metrics.active_seats,
      equipment_records: metrics.equipment_records,
      work_orders: metrics.work_orders,
    },
    { onConflict: "metric_date" },
  )

  if (upErr) {
    return NextResponse.json({ error: "upsert_failed", message: upErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, metric_date, metrics })
}
