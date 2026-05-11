import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export const PLATFORM_MEMBERSHIP_ORG_SAMPLE_CAP = 60

export type BlitzpayPlatformMembershipRollup = {
  sampledOrganizations: number
  organizationsWithMemberships: number
  totalActiveMembershipsSample: number
  totalMrrCentsSample: number
  delinquentMembershipsSample: number
  openFailuresSample: number
  avgAutopayAdoptionPctSample: number
  /** Simple trend proxy: delinquents / active in sample (0–100). */
  delinquencyPressurePct: number
}

export async function fetchBlitzpayPlatformMembershipRollup(
  admin: SupabaseClient,
): Promise<BlitzpayPlatformMembershipRollup> {
  const { data: orgs, error } = await admin.from("organizations").select("id").order("created_at", { ascending: false }).limit(
    PLATFORM_MEMBERSHIP_ORG_SAMPLE_CAP,
  )
  if (error) throw new Error(error.message)
  const ids = (orgs ?? []).map((o) => (o as { id: string }).id)
  let organizationsWithMemberships = 0
  let totalActiveMembershipsSample = 0
  let totalMrrCentsSample = 0
  let delinquentMembershipsSample = 0
  let openFailuresSample = 0
  let autopaySum = 0
  let autopayN = 0

  for (const organizationId of ids) {
    const { data: rows, error: rErr } = await admin
      .from("blitzpay_memberships")
      .select("status, recurring_amount_cents, billing_frequency, auto_bill_enabled")
      .eq("organization_id", organizationId)
      .limit(200)
    if (rErr || !rows?.length) continue
    organizationsWithMemberships += 1
    let active = 0
    let del = 0
    let mrr = 0
    let apOn = 0
    for (const r of rows as Array<{ status: string; recurring_amount_cents: number; billing_frequency: string; auto_bill_enabled: boolean }>) {
      const st = String(r.status || "").toLowerCase()
      if (st === "active") {
        active += 1
        if (r.auto_bill_enabled) apOn += 1
        const c = Math.max(0, Math.round(Number(r.recurring_amount_cents)))
        const f = String(r.billing_frequency || "").toLowerCase()
        if (f === "weekly") mrr += Math.round((c * 52) / 12)
        else if (f === "monthly") mrr += c
        else if (f === "quarterly") mrr += Math.round(c / 3)
        else if (f === "annual") mrr += Math.round(c / 12)
        else mrr += c
      } else if (st === "delinquent") {
        del += 1
      }
    }
    totalActiveMembershipsSample += active
    delinquentMembershipsSample += del
    totalMrrCentsSample += mrr
    if (active > 0) {
      autopaySum += Math.round((apOn / active) * 1000) / 10
      autopayN += 1
    }
    const { count: fc } = await admin
      .from("blitzpay_membership_payment_failures")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("recovery_status", "open")
    openFailuresSample += fc ?? 0
  }

  const avgAutopayAdoptionPctSample = autopayN > 0 ? Math.round((autopaySum / autopayN) * 10) / 10 : 0
  const delinquencyPressurePct =
    totalActiveMembershipsSample > 0
      ? Math.min(100, Math.round((delinquentMembershipsSample / totalActiveMembershipsSample) * 1000) / 10)
      : 0

  return {
    sampledOrganizations: ids.length,
    organizationsWithMemberships,
    totalActiveMembershipsSample,
    totalMrrCentsSample,
    delinquentMembershipsSample,
    openFailuresSample,
    avgAutopayAdoptionPctSample,
    delinquencyPressurePct,
  }
}
