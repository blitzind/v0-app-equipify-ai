import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchBlitzpayPlatformOperationsSummary } from "@/lib/blitzpay/blitzpay-platform-operations"
import { fetchBlitzpayPlatformRevenueRollup } from "@/lib/blitzpay/blitzpay-revenue-intelligence"
import { runBlitzpaySchemaHealthCheckCached } from "@/lib/blitzpay/blitzpay-schema-health"

export type BlitzpayPlatformCommandCenterRollup = {
  reportingWindowDays: number
  /** Distinct orgs observed in capped open vendor-payable scan. */
  orgsWithOpenVendorPayablesApprox: number
  /** Distinct orgs with at least one overdue open vendor payable in capped scan. */
  orgsVendorPayablesOverdueApprox: number
  /** Workspaces with Connect account but charges not enabled (capped sample). */
  orgsLaunchReadinessConnectGapApprox: number
  orgsStaleConnectSync7d: number
  openDisputesPlatformSample: number
  pendingRefundsPlatform: number
  failedPaymentAttempts7d: number
  schemaHealthOk: boolean
  schemaHealthMessage: string | null
}

/**
 * Bounded platform-wide rollup for the BlitzPay financial command center (admin only).
 */
export async function fetchBlitzpayPlatformCommandCenterRollup(
  admin: SupabaseClient,
  options?: { reportingWindowDays?: number },
): Promise<BlitzpayPlatformCommandCenterRollup> {
  const reportingWindowDays = Math.min(90, Math.max(7, Math.round(Number(options?.reportingWindowDays ?? 30))))
  const todayYmd = new Date().toISOString().slice(0, 10)
  const todayMs = Date.parse(`${todayYmd}T00:00:00.000Z`)

  const [ops, revenue, schemaHealth] = await Promise.all([
    fetchBlitzpayPlatformOperationsSummary(admin),
    fetchBlitzpayPlatformRevenueRollup(admin, { reportingWindowDays }),
    runBlitzpaySchemaHealthCheckCached(admin),
  ])

  let orgsWithOpenVendorPayablesApprox = 0
  let orgsVendorPayablesOverdueApprox = 0
  try {
    const { data, error } = await admin
      .from("blitzpay_vendor_payables")
      .select("organization_id, due_date, status")
      .in("status", ["draft", "pending_approval", "approved", "scheduled"])
      .limit(4000)
    if (!error && data) {
      const orgs = new Set<string>()
      const overdueOrgs = new Set<string>()
      for (const r of data as Array<{ organization_id?: string; due_date?: string; status?: string }>) {
        const oid = String(r.organization_id ?? "")
        if (!oid) continue
        orgs.add(oid)
        const due = String(r.due_date ?? "").slice(0, 10)
        const dueMs = Date.parse(`${due}T00:00:00.000Z`)
        if (Number.isFinite(dueMs) && dueMs < todayMs) overdueOrgs.add(oid)
      }
      orgsWithOpenVendorPayablesApprox = orgs.size
      orgsVendorPayablesOverdueApprox = overdueOrgs.size
    }
  } catch {
    /* table may be missing */
  }

  let orgsLaunchReadinessConnectGapApprox = 0
  try {
    const { data, error } = await admin
      .from("organizations")
      .select("id")
      .eq("status", "active")
      .not("stripe_connect_account_id", "is", null)
      .eq("stripe_charges_enabled", false)
      .limit(800)
    if (!error && data) orgsLaunchReadinessConnectGapApprox = data.length
  } catch {
    /* ignore */
  }

  return {
    reportingWindowDays,
    orgsWithOpenVendorPayablesApprox,
    orgsVendorPayablesOverdueApprox,
    orgsLaunchReadinessConnectGapApprox,
    orgsStaleConnectSync7d: ops.orgsStaleConnectSync7d,
    openDisputesPlatformSample: revenue.openDisputesPlatformCount,
    pendingRefundsPlatform: ops.pendingRefunds,
    failedPaymentAttempts7d: ops.failedPaymentAttempts7d,
    schemaHealthOk: schemaHealth.ok,
    schemaHealthMessage:
      schemaHealth.ok ? null
      : schemaHealth.kind === "schema_incomplete" ?
        `Schema incomplete: ${schemaHealth.missing}`
      : schemaHealth.detail,
  }
}
