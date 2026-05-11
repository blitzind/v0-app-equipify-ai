import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runBlitzpaySchemaHealthCheckCached, type BlitzpaySchemaHealthResult } from "@/lib/blitzpay/blitzpay-schema-health"

export type BlitzpayPlatformOperationsSummary = {
  orgsBlitzpayEnabled: number
  orgsConnectChargesReady: number
  volumeCapturedCents30d: number
  failedPaymentAttempts7d: number
  openDisputes: number
  pendingRefunds: number
  webhookDead24h: number
  reminderRunsFailed7d: number
  reminderDispatchFailures7d: number
  orgsStaleConnectSync7d: number
  schemaHealth: BlitzpaySchemaHealthResult
  /** ISO timestamps of recent reminder runs (success + failed). */
  recentReminderRuns: Array<{
    id: string
    trigger: string
    status: string
    remindersEvaluated: number
    remindersSent: number
    remindersSkipped: number
    createdAt: string
    finishedAt: string | null
    error: string | null
  }>
  alerts: Array<{ severity: "critical" | "warning" | "info"; code: string; message: string }>
}

const DISPUTE_TERMINAL = new Set(["won", "lost", "charge_refunded", "closed"])

export async function fetchBlitzpayPlatformOperationsSummary(admin: SupabaseClient): Promise<BlitzpayPlatformOperationsSummary> {
  const since30d = new Date(Date.now() - 30 * 86400_000).toISOString()
  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString()
  const since24h = new Date(Date.now() - 86400_000).toISOString()
  const connectStaleBefore = new Date(Date.now() - 7 * 86400_000).toISOString()

  const schemaHealth = await runBlitzpaySchemaHealthCheckCached(admin)

  const [
    payEnabledRes,
    chargesReadyRes,
    volRow,
    failedAttemptsRes,
    disputesRes,
    pendingRefundsRes,
    webhookDeadRes,
    reminderRunsFailedRes,
    remFailedDispRes,
    staleNullRes,
    staleOldRes,
    recentRuns,
  ] = await Promise.all([
    admin
      .from("blitzpay_org_settings")
      .select("organization_id", { count: "exact", head: true })
      .eq("blitzpay_invoice_pay_enabled", true),
    admin
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .not("stripe_connect_account_id", "is", null)
      .eq("stripe_charges_enabled", true)
      .eq("status", "active"),
    admin
      .from("blitzpay_payment_intents")
      .select("amount_cents")
      .eq("status", "succeeded")
      .gte("created_at", since30d)
      .limit(5000),
    admin
      .from("blitzpay_invoice_payment_attempts")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", since7d),
    admin.from("blitzpay_invoice_disputes").select("status").limit(2000),
    admin
      .from("blitzpay_invoice_refunds")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("blitzpay_webhook_inbox")
      .select("stripe_event_id", { count: "exact", head: true })
      .eq("processing_status", "dead")
      .gte("created_at", since24h),
    admin
      .from("blitzpay_reminder_runs")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", since7d),
    admin
      .from("blitzpay_payment_reminders")
      .select("id", { count: "exact", head: true })
      .eq("dispatch_status", "failed")
      .gte("updated_at", since7d),
    admin
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .not("stripe_connect_account_id", "is", null)
      .is("last_stripe_connect_sync_at", null),
    admin
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .not("stripe_connect_account_id", "is", null)
      .not("last_stripe_connect_sync_at", "is", null)
      .lt("last_stripe_connect_sync_at", connectStaleBefore),
    admin
      .from("blitzpay_reminder_runs")
      .select("id, trigger, status, reminders_evaluated, reminders_sent, reminders_skipped, created_at, finished_at, error")
      .order("created_at", { ascending: false })
      .limit(15),
  ])

  let volumeCapturedCents30d = 0
  for (const row of (volRow.data ?? []) as Array<{ amount_cents?: string | number }>) {
    const n = Math.round(Number(row.amount_cents ?? 0))
    if (Number.isFinite(n)) volumeCapturedCents30d += n
  }

  let openDisputes = 0
  for (const d of disputesRes.data ?? []) {
    const st = String((d as { status?: string }).status ?? "").toLowerCase()
    if (!DISPUTE_TERMINAL.has(st)) openDisputes += 1
  }

  const recentReminderRuns = ((recentRuns.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    trigger: String(r.trigger ?? ""),
    status: String(r.status ?? ""),
    remindersEvaluated: Math.round(Number(r.reminders_evaluated ?? 0)),
    remindersSent: Math.round(Number(r.reminders_sent ?? 0)),
    remindersSkipped: Math.round(Number(r.reminders_skipped ?? 0)),
    createdAt: String(r.created_at ?? ""),
    finishedAt: r.finished_at ? String(r.finished_at) : null,
    error: r.error ? String(r.error) : null,
  }))

  const alerts: BlitzpayPlatformOperationsSummary["alerts"] = []
  if (!schemaHealth.ok) {
    alerts.push({
      severity: "critical",
      code: "schema_incomplete",
      message:
        schemaHealth.kind === "schema_incomplete" ?
          `Schema incomplete: ${schemaHealth.missing}`
        : `BlitzPay schema check failed: ${schemaHealth.detail}`,
    })
  }
  const webhookDead24h = webhookDeadRes.count ?? 0
  const reminderRunsFailed7d = reminderRunsFailedRes.count ?? 0
  const reminderDispatchFailures7d = remFailedDispRes.count ?? 0
  const orgsStaleConnectSync7d = (staleNullRes.count ?? 0) + (staleOldRes.count ?? 0)

  if (webhookDead24h > 0) {
    alerts.push({
      severity: "warning",
      code: "webhook_dead_events",
      message: `${webhookDead24h} webhook inbox row(s) marked dead in the last 24h.`,
    })
  }
  if (reminderRunsFailed7d > 0 || reminderDispatchFailures7d > 0) {
    alerts.push({
      severity: "warning",
      code: "reminder_failures",
      message: `Reminder health: ${reminderRunsFailed7d} failed run(s) (7d), ${reminderDispatchFailures7d} failed dispatch row(s) (7d).`,
    })
  }
  if ((failedAttemptsRes.count ?? 0) >= 25) {
    alerts.push({
      severity: "warning",
      code: "high_failed_attempt_volume",
      message: `${failedAttemptsRes.count ?? 0} failed BlitzPay payment attempts in the last 7 days.`,
    })
  }
  if (orgsStaleConnectSync7d > 0) {
    alerts.push({
      severity: "info",
      code: "stale_connect_sync",
      message: `${orgsStaleConnectSync7d} active workspace(s) have Stripe Connect sync older than 7 days or never synced.`,
    })
  }

  return {
    orgsBlitzpayEnabled: payEnabledRes.count ?? 0,
    orgsConnectChargesReady: chargesReadyRes.count ?? 0,
    volumeCapturedCents30d,
    failedPaymentAttempts7d: failedAttemptsRes.count ?? 0,
    openDisputes,
    pendingRefunds: pendingRefundsRes.count ?? 0,
    webhookDead24h,
    reminderRunsFailed7d,
    reminderDispatchFailures7d,
    orgsStaleConnectSync7d,
    schemaHealth,
    recentReminderRuns,
    alerts,
  }
}
