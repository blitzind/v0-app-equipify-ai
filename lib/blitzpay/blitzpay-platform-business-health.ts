import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchBlitzpayBusinessHealth } from "@/lib/blitzpay/blitzpay-business-health"

const MAX_ORGS = 10

export type BlitzpayPlatformBusinessHealthRollup = {
  reportingWindowDays: number
  generatedAt: string
  orgsSampled: number
  averageOverallHealth: number
  averageFinancialHealth: number
  averageCollectionsHealth: number
  /** Count of sampled orgs with overall below 55. */
  orgsUnderStressApprox: number
  /** Aggregated bottleneck themes from deterministic strings (capped). */
  commonBottlenecks: string[]
  averageArPressureRatio: number
  financingAdoptionRatePct: number
  averageReminderDispatchPct: number
  averagePayoutDelayDays: number | null
  recurringRevenueSignalAvg: number
  topGrowthOpportunityThemes: string[]
}

function topStrings(rows: string[], limit: number): string[] {
  const freq = new Map<string, number>()
  for (const r of rows) {
    const k = r.trim()
    if (!k) continue
    freq.set(k, (freq.get(k) ?? 0) + 1)
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([s]) => s)
}

/**
 * Platform-only, sampled rollup (bounded org fan-out). Not statistically perfect — for admin monitoring.
 */
export async function fetchBlitzpayPlatformBusinessHealthRollup(
  admin: SupabaseClient,
  options?: { reportingWindowDays?: number },
): Promise<BlitzpayPlatformBusinessHealthRollup> {
  const reportingWindowDays = Math.min(90, Math.max(7, Math.round(Number(options?.reportingWindowDays ?? 30))))
  const { data: orgs, error } = await admin
    .from("organizations")
    .select("id")
    .eq("status", "active")
    .not("stripe_connect_account_id", "is", null)
    .order("id", { ascending: true })
    .limit(MAX_ORGS)
  if (error) throw new Error(error.message)
  const ids = (orgs ?? []).map((o) => (o as { id: string }).id).filter(Boolean)
  const healthRows: Awaited<ReturnType<typeof fetchBlitzpayBusinessHealth>>[] = []
  for (const id of ids) {
    try {
      healthRows.push(await fetchBlitzpayBusinessHealth(admin, id, { reportingWindowDays }))
    } catch {
      /* skip org */
    }
  }
  const n = healthRows.length
  if (n === 0) {
    return {
      reportingWindowDays,
      generatedAt: new Date().toISOString(),
      orgsSampled: 0,
      averageOverallHealth: 0,
      averageFinancialHealth: 0,
      averageCollectionsHealth: 0,
      orgsUnderStressApprox: 0,
      commonBottlenecks: [],
      averageArPressureRatio: 0,
      financingAdoptionRatePct: 0,
      averageReminderDispatchPct: 0,
      averagePayoutDelayDays: null,
      recurringRevenueSignalAvg: 0,
      topGrowthOpportunityThemes: [],
    }
  }
  let sumOverall = 0
  let sumFin = 0
  let sumCol = 0
  let under = 0
  let arRatioSum = 0
  let finSessions = 0
  let remSum = 0
  let delaySum = 0
  let delayN = 0
  let installSum = 0
  const bottleneckPool: string[] = []
  const growthPool: string[] = []
  for (const h of healthRows) {
    sumOverall += h.scores.overall
    sumFin += h.scores.financial
    sumCol += h.scores.collections
    if (h.scores.overall < 55) under += 1
    const g = Math.max(1, h.facts.grossCollectedWindowCents)
    arRatioSum += h.facts.overdueCollectibleCents / g
    finSessions += h.facts.financingAdoptionSessions > 0 ? 1 : 0
    remSum += h.facts.reminderEffectivenessRatePct
    if (h.facts.treasuryAveragePayoutDelayDays != null) {
      delaySum += h.facts.treasuryAveragePayoutDelayDays
      delayN += 1
    }
    installSum += h.facts.activeInstallmentPlansCount
    for (const w of h.warnings) bottleneckPool.push(w)
    for (const r of h.recommendations.filter((x) => x.severity !== "info")) bottleneckPool.push(r.message)
    for (const line of h.growthOpportunities) growthPool.push(line)
  }
  return {
    reportingWindowDays,
    generatedAt: new Date().toISOString(),
    orgsSampled: n,
    averageOverallHealth: Math.round((sumOverall / n) * 10) / 10,
    averageFinancialHealth: Math.round((sumFin / n) * 10) / 10,
    averageCollectionsHealth: Math.round((sumCol / n) * 10) / 10,
    orgsUnderStressApprox: under,
    commonBottlenecks: topStrings(bottleneckPool, 8),
    averageArPressureRatio: Math.round((arRatioSum / n) * 1000) / 1000,
    financingAdoptionRatePct: Math.round((finSessions / n) * 1000) / 10,
    averageReminderDispatchPct: Math.round((remSum / n) * 10) / 10,
    averagePayoutDelayDays: delayN === 0 ? null : Math.round((delaySum / delayN) * 10) / 10,
    recurringRevenueSignalAvg: Math.round((installSum / n) * 10) / 10,
    topGrowthOpportunityThemes: topStrings(growthPool, 6),
  }
}
