import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin"
import { computePlatformMetrics } from "@/lib/platform-analytics-compute"

export type PlatformMetricsDailyRow = {
  metric_date: string
  total_accounts: number
  active_accounts: number
  trialing_accounts: number
  archived_accounts: number
  /** Paid MRR only (matches DB `total_mrr`). */
  total_mrr_cents: number
  trial_pipeline_mrr_cents: number
  active_seats: number
  equipment_records: number
  work_orders: number
}

function parseNumeric(n: unknown): number {
  if (typeof n === "number" && Number.isFinite(n)) return n
  if (typeof n === "string") {
    const v = parseFloat(n)
    return Number.isFinite(v) ? v : 0
  }
  return 0
}

function monthStart(y: number, m: number): Date {
  return new Date(Date.UTC(y, m, 1))
}

function parseDateOnly(s: string): Date {
  const [y, mo, da] = s.split("-").map((x) => parseInt(x, 10))
  return new Date(Date.UTC(y, mo - 1, da))
}

function monthLabel(d: Date): string {
  return d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })
}

/**
 * Last 6 calendar months (UTC): for each month, MRR (cents) from the latest snapshot in that month.
 * Missing months forward-fill from the previous known value; if nothing yet, use `fallbackMrrCents`.
 */
function buildMonthlyMrrChart(
  history: PlatformMetricsDailyRow[],
  fallbackMrrCents: number,
): { month: string; mrr: number }[] {
  const today = new Date()
  const endYear = today.getUTCFullYear()
  const endMonth = today.getUTCMonth()

  const buckets: { label: string; y: number; m: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = monthStart(endYear, endMonth - i)
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth()
    buckets.push({
      label: monthLabel(d),
      y,
      m,
    })
  }

  const sorted = [...history].sort((a, b) => a.metric_date.localeCompare(b.metric_date))

  let carry = fallbackMrrCents
  const out: { month: string; mrr: number }[] = []

  for (const b of buckets) {
    const inMonth = sorted.filter((row) => {
      const dt = parseDateOnly(row.metric_date)
      return dt.getUTCFullYear() === b.y && dt.getUTCMonth() === b.m
    })
    let mrr = carry
    if (inMonth.length > 0) {
      const best = inMonth.reduce((a, c) => (a.metric_date > c.metric_date ? a : c))
      mrr = best.total_mrr_cents
    }
    carry = mrr
    out.push({ month: b.label, mrr })
  }

  return out
}

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

  let current
  try {
    current = await computePlatformMetrics(admin)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed to compute metrics"
    return NextResponse.json({ error: "compute_failed", message: msg }, { status: 500 })
  }

  const cutoff = new Date()
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 6)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const { data: rows, error: histErr } = await admin
    .from("platform_metrics_daily")
    .select(
      "metric_date, total_accounts, active_accounts, trialing_accounts, archived_accounts, total_mrr, trial_pipeline_mrr, active_seats, equipment_records, work_orders",
    )
    .gte("metric_date", cutoffStr)
    .order("metric_date", { ascending: true })

  if (histErr) {
    return NextResponse.json({ error: "query_failed", message: histErr.message }, { status: 500 })
  }

  const history: PlatformMetricsDailyRow[] = (rows ?? []).map((r) => {
    const raw = r as Record<string, unknown>
    return {
      metric_date: String(r.metric_date),
      total_accounts: Number(r.total_accounts ?? 0),
      active_accounts: Number(r.active_accounts ?? 0),
      trialing_accounts: Number(r.trialing_accounts ?? 0),
      archived_accounts: Number(r.archived_accounts ?? 0),
      total_mrr_cents: Math.round(parseNumeric(r.total_mrr)),
      trial_pipeline_mrr_cents: Math.round(parseNumeric(raw.trial_pipeline_mrr)),
      active_seats: Number(r.active_seats ?? 0),
      equipment_records: Number(r.equipment_records ?? 0),
      work_orders: Number(r.work_orders ?? 0),
    }
  })

  const chart_monthly = buildMonthlyMrrChart(history, current.total_mrr_cents)

  let mrr_growth_pct: number | null = null
  if (chart_monthly.length >= 2) {
    const cur = chart_monthly[chart_monthly.length - 1]?.mrr ?? 0
    const prev = chart_monthly[chart_monthly.length - 2]?.mrr ?? 0
    if (prev > 0) mrr_growth_pct = ((cur - prev) / prev) * 100
    else if (cur > 0 && prev === 0) mrr_growth_pct = 100
    else mrr_growth_pct = 0
  }

  let account_growth_pct: number | null = null
  const approx30 = new Date()
  approx30.setUTCDate(approx30.getUTCDate() - 30)
  const key30 = approx30.toISOString().slice(0, 10)
  const before30 = history.filter((h) => h.metric_date <= key30)
  const ref30 = before30.length > 0 ? before30[before30.length - 1] : null
  if (ref30) {
    const pa = ref30.total_accounts
    if (pa > 0) account_growth_pct = ((current.total_accounts - pa) / pa) * 100
    else if (current.total_accounts > 0) account_growth_pct = 100
    else account_growth_pct = 0
  }

  return NextResponse.json({
    current,
    history,
    chart_monthly,
    mrr_growth_pct,
    account_growth_pct,
  })
}
