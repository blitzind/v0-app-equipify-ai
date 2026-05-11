import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
import { computeBlitzpayCollectionsReporting } from "@/lib/blitzpay/blitzpay-collections"
import { fetchBlitzpayCollectionsAccelerationMetrics } from "@/lib/blitzpay/blitzpay-collections-acceleration-metrics"

const ORG_SAMPLE_CAP = 10

export type BlitzpayPlatformCollectionsRollup = {
  reportingWindowDays: number
  generatedAt: string
  orgsSampled: number
  overdueCollectibleCentsTotalApprox: number
  estimatedRecoverableOverdueCentsApprox: number
  fieldCollectibleCentsApprox: number
  installmentPlansActiveApprox: number
  achAdoptionOrgsApprox: number
  averageReminderDispatchPct: number
  topRiskThemes: string[]
}

/**
 * Platform admin rollup — bounded org fan-out, approximate totals.
 */
export async function fetchBlitzpayPlatformCollectionsRollup(
  admin: SupabaseClient,
  options?: { reportingWindowDays?: number },
): Promise<BlitzpayPlatformCollectionsRollup> {
  const reportingWindowDays = Math.min(90, Math.max(7, Math.round(Number(options?.reportingWindowDays ?? 30))))
  const sinceIso = new Date(Date.now() - reportingWindowDays * 86400_000).toISOString()

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

  let overdueCollectibleCentsTotalApprox = 0
  let estimatedRecoverableOverdueCentsApprox = 0
  let fieldCollectibleCentsApprox = 0
  let sumInstallPlansPerOrg = 0
  let achOrgs = 0
  let reminderPctSum = 0
  const themes: string[] = []

  for (const orgId of ids) {
    try {
      const collections = await computeBlitzpayCollectionsReporting(admin, orgId)
      const { data: mixRow } = await admin
        .from("blitzpay_payment_intents")
        .select("payment_method_type")
        .eq("organization_id", orgId)
        .eq("status", "succeeded")
        .limit(200)
      let card = 0
      let ach = 0
      let unk = 0
      for (const r of (mixRow ?? []) as Array<{ payment_method_type: string | null }>) {
        const t = String(r.payment_method_type || "unknown").toLowerCase()
        if (t === "card") card += 1
        else if (t === "us_bank_account") ach += 1
        else unk += 1
      }
      if (ach >= card && ach > 0) achOrgs += 1

      const { count: pc } = await admin
        .from("blitzpay_payment_plans")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .in("status", ["active", "staged"])
      sumInstallPlansPerOrg += Math.min(500, pc ?? 0)

      const accel = await fetchBlitzpayCollectionsAccelerationMetrics(admin, orgId, {
        sinceIso,
        paymentMethodMix: { card, us_bank_account: ach, unknown: unk },
        activeInstallmentPlansCount: pc ?? 0,
        collectionsPulse: { reminderEffectivenessRatePct: collections.reminderEffectivenessRatePct },
      })
      overdueCollectibleCentsTotalApprox += accel.overdueCollectibleCents
      estimatedRecoverableOverdueCentsApprox += accel.estimatedRecoverableOverdueCents
      fieldCollectibleCentsApprox += accel.likelyFieldCollectibleCents
      reminderPctSum += collections.reminderEffectivenessRatePct
      if (accel.overdueCollectibleCents > 100_000) themes.push("large_overdue_balance")
      if (accel.likelyFieldCollectibleCents > 25_000) themes.push("field_collection_window")
      if (collections.abandonedCheckoutInvoices >= 2) themes.push("checkout_abandonment")
    } catch {
      /* org may lack BlitzPay tables */
    }
  }

  const n = Math.max(1, ids.length)
  const themeCounts = new Map<string, number>()
  for (const t of themes) themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1)
  const topRiskThemes = [...themeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k.replace(/_/g, " "))

  return {
    reportingWindowDays,
    generatedAt: new Date().toISOString(),
    orgsSampled: ids.length,
    overdueCollectibleCentsTotalApprox,
    estimatedRecoverableOverdueCentsApprox,
    fieldCollectibleCentsApprox,
    installmentPlansActiveApprox: Math.round(sumInstallPlansPerOrg / n),
    achAdoptionOrgsApprox: achOrgs,
    averageReminderDispatchPct: Math.round((reminderPctSum / n) * 10) / 10,
    topRiskThemes: topRiskThemes.length ? topRiskThemes : ["no_sample_signal"],
  }
}
