import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchBlitzpayRecurringRevenueMetrics } from "@/lib/blitzpay/blitzpay-recurring-billing"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ORG_SAMPLE_CAP = 12

export type BlitzpayPlatformRecurringRevenueRollup = {
  reportingWindowDays: number
  generatedAt: string
  orgsSampled: number
  averagePlannedRecurring30dCents: number
  averageAutopayAdoptionPct: number
  averageRenewalSuccessProxyPct: number
  averageChurnRiskScore0to100: number
  orgsWithFailedRenewalsApprox: number
  topOperationalThemes: string[]
}

export async function fetchBlitzpayPlatformRecurringRevenueRollup(
  admin: SupabaseClient,
  options?: { reportingWindowDays?: number },
): Promise<BlitzpayPlatformRecurringRevenueRollup> {
  const reportingWindowDays = Math.min(90, Math.max(7, Math.round(Number(options?.reportingWindowDays ?? 30))))
  const { data: orgs, error } = await admin
    .from("organizations")
    .select("id")
    .not("stripe_connect_account_id", "is", null)
    .limit(ORG_SAMPLE_CAP * 4)
  if (error) throw new Error(error.message)

  const ids = (orgs ?? [])
    .map((o) => (o as { id: string }).id)
    .filter((id) => UUID_RE.test(id))
    .slice(0, ORG_SAMPLE_CAP)

  let sum30 = 0
  let sumAutopay = 0
  let sumRenew = 0
  let sumChurn = 0
  let failedOrgs = 0
  const themes: string[] = []

  for (const orgId of ids) {
    try {
      const m = await fetchBlitzpayRecurringRevenueMetrics(admin, orgId, { reportingWindowDays })
      sum30 += m.recurringPlannedInflow30dCents
      sumAutopay += m.autopayAdoptionPct
      sumRenew += m.renewalSuccessProxyPct
      sumChurn += m.churnRiskScore0to100
      if (m.scheduledFailedWindowCount > 0) {
        failedOrgs += 1
        themes.push("failed_scheduled_renewal")
      }
      if (m.customersMissingAutopayWithActivePlans >= 2) themes.push("missing_autopay_on_plans")
      if (m.contractExpiring30dCount >= 3) themes.push("contract_renewal_window")
    } catch {
      /* org missing BlitzPay tables */
    }
  }

  const n = Math.max(1, ids.length)
  const themeCounts = new Map<string, number>()
  for (const t of themes) themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1)
  const topOperationalThemes = [...themeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k.replace(/_/g, " "))

  return {
    reportingWindowDays,
    generatedAt: new Date().toISOString(),
    orgsSampled: ids.length,
    averagePlannedRecurring30dCents: Math.round(sum30 / n),
    averageAutopayAdoptionPct: Math.round((sumAutopay / n) * 10) / 10,
    averageRenewalSuccessProxyPct: Math.round((sumRenew / n) * 10) / 10,
    averageChurnRiskScore0to100: Math.round((sumChurn / n) * 10) / 10,
    orgsWithFailedRenewalsApprox: failedOrgs,
    topOperationalThemes: topOperationalThemes.length ? topOperationalThemes : ["no_sample_signal"],
  }
}
